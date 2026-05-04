import "../../chunks/index-server.js";
import { R as attr, a as derived, c as stringify, i as bind_props, n as attr_class, o as head, r as attr_style, z as escape_html } from "../../chunks/dev.js";
//#region src/lib/state.svelte.ts
var AppState = class {
	audioCtx = null;
	audioBuffer = null;
	fileName = "";
	fileInfoText = "";
	isPlaying = false;
	sourceNode = null;
	filterNode = null;
	fadeNode = null;
	normalizeNode = null;
	playStartTime = 0;
	playOffset = 0;
	animFrameId = null;
	trimStart = 0;
	trimEnd = 1;
	markerPos = 0;
	zoomLevel = 1;
	MAX_ZOOM = 32;
	spectrogramData = null;
	spectrogramCols = 0;
	spectrogramRows = 0;
	spectrogramTotalWidth = 0;
	hpEnabled = true;
	hpFreq = 100;
	normalizeEnabled = true;
	fadeEnabled = true;
	fadeDuration = 1;
	isLoading = false;
	loadingText = "Processing...";
	timeDisplayText = "0:00.0 / 0:00.0";
	timeStartText = "0:00.0";
	timeEndText = "0:00.0";
	/**
	* Ensure AudioContext exists and is running.
	* Must be called from a user gesture on iOS.
	*/
	ensureAudioCtx() {
		if (!this.audioCtx) {
			const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
			this.audioCtx = new AudioCtx();
		}
		if (this.audioCtx.state === "suspended") this.audioCtx.resume();
	}
};
var appState = new AppState();
//#endregion
//#region src/lib/utils.ts
/**
* Shared utility functions.
*/
/**
* Format seconds as m:ss.t
*/
function formatTime(sec) {
	if (!isFinite(sec)) return "0:00.0";
	const m = Math.floor(sec / 60);
	const s = sec - m * 60;
	return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}
//#endregion
//#region src/lib/playback.ts
/**
* Audio playback with live HP filter preview and marker support.
* DOM refs (cursor, wrapper, inner) are set once via initPlayback().
* Settings are read from appState instead of DOM inputs.
*/
var _cursor = null;
var _wrapper = null;
var _inner = null;
function updateTimeDisplay(currentSec) {
	if (!appState.audioBuffer) return;
	const dur = appState.audioBuffer.duration;
	const sec = currentSec ?? appState.markerPos * dur;
	const regionStart = appState.trimStart * dur;
	const regionDur = appState.trimEnd * dur - regionStart;
	appState.timeDisplayText = formatTime(sec - regionStart) + " / " + formatTime(regionDur);
}
function animate() {
	if (!appState.isPlaying) {
		if (_cursor) _cursor.style.display = "none";
		return;
	}
	const ctx = appState.audioCtx;
	const dur = appState.audioBuffer.duration;
	const elapsed = ctx.currentTime - appState.playStartTime;
	const currentSec = appState.playOffset + elapsed;
	const frac = currentSec / dur;
	if (_cursor) {
		const totalWidth = appState.spectrogramTotalWidth || (_inner ? parseFloat(_inner.style.width) || _wrapper?.clientWidth || 0 : 0);
		_cursor.style.left = frac * totalWidth + "px";
	}
	updateTimeDisplay(currentSec);
	if (_wrapper && _cursor) {
		const cursorPx = frac * (appState.spectrogramTotalWidth || parseFloat(_inner?.style.width ?? "0") || _wrapper.clientWidth);
		const wrapperWidth = _wrapper.clientWidth;
		const scrollLeft = _wrapper.scrollLeft;
		if (cursorPx < scrollLeft || cursorPx > scrollLeft + wrapperWidth) _wrapper.scrollLeft = cursorPx - wrapperWidth / 3;
	}
	appState.animFrameId = requestAnimationFrame(animate);
}
//#endregion
//#region src/lib/components/Spectrogram.svelte
function Spectrogram($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { wrapperEl = void 0 } = $$props;
		let markerLeftPx = derived(() => appState.markerPos * appState.spectrogramTotalWidth);
		let trimLeftWidth = derived(() => appState.trimStart * appState.spectrogramTotalWidth);
		let trimRightWidth = derived(() => (1 - appState.trimEnd) * appState.spectrogramTotalWidth);
		let handleLeftLeft = derived(() => appState.trimStart * appState.spectrogramTotalWidth - 2);
		let handleRightLeft = derived(() => appState.trimEnd * appState.spectrogramTotalWidth - 2);
		$$renderer.push(`<div class="spectrogram-wrapper"><div class="freq-axis"></div> <div class="spectrogram-scroll-wrap"><div class="time-ruler"></div> <div class="spectrogram-inner" role="button" tabindex="0"><canvas></canvas> <div class="trim-overlay-left"${attr_style("", { width: `${stringify(trimLeftWidth())}px` })}></div> <div class="trim-overlay-right"${attr_style("", { width: `${stringify(trimRightWidth())}px` })}></div> <div class="trim-handle" role="slider" tabindex="0" aria-label="Trim start"${attr("aria-valuenow", appState.trimStart)}${attr("aria-valuemin", 0)}${attr("aria-valuemax", 1)}${attr_style("", { left: `${stringify(handleLeftLeft())}px` })}></div> <div class="trim-handle" role="slider" tabindex="0" aria-label="Trim end"${attr("aria-valuenow", appState.trimEnd)}${attr("aria-valuemin", 0)}${attr("aria-valuemax", 1)}${attr_style("", { left: `${stringify(handleRightLeft())}px` })}></div> <div class="playback-marker"${attr_style("", {
			left: `${stringify(markerLeftPx())}px`,
			display: appState.audioBuffer ? "block" : "none"
		})}></div> <div class="playback-cursor"${attr_style("", { display: "none" })}></div></div></div></div> <div class="time-bar"><span>${escape_html(appState.timeStartText)}</span> <span>${escape_html(appState.timeEndText)}</span></div>`);
		bind_props($$props, { wrapperEl });
	});
}
//#endregion
//#region src/lib/components/PlaybackControls.svelte
function PlaybackControls($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div class="playback-controls"><button class="rewind-btn">◀</button> <button class="play-btn">`);
		if (appState.isPlaying) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`▮▮`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`▶`);
		}
		$$renderer.push(`<!--]--></button> <div class="time-display">${escape_html(appState.timeDisplayText)}</div></div>`);
	});
}
//#endregion
//#region src/lib/components/Settings.svelte
function Settings($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div class="settings"><div class="setting-row"><span class="setting-label">High-pass filter</span> <div class="setting-control"><input type="range" id="hpFreq" min="50" max="500" step="10"${attr("value", appState.hpFreq)}/> <span class="setting-value">${escape_html(appState.hpFreq)} Hz</span> <input type="checkbox" id="hpEnabled"${attr("checked", appState.hpEnabled, true)}/></div></div> <div class="setting-row"><span class="setting-label">Normalize to −3 dB</span> <div class="setting-control"><input type="checkbox" id="normalizeEnabled"${attr("checked", appState.normalizeEnabled, true)}/></div></div> <div class="setting-row"><span class="setting-label">Fade in / out</span> <div class="setting-control"><input type="range" id="fadeDuration" min="0.5" max="5" step="0.5"${attr("value", appState.fadeDuration)}${attr("disabled", !appState.fadeEnabled, true)}/> <span class="setting-value">${escape_html(appState.fadeDuration.toFixed(1))} s</span> <input type="checkbox" id="fadeEnabled"${attr("checked", appState.fadeEnabled, true)}/></div></div></div>`);
	});
}
//#endregion
//#region src/lib/components/LoadingOverlay.svelte
function LoadingOverlay($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div${attr_class("loading-overlay", void 0, { "visible": appState.isLoading })}><div class="loading-box"><div class="spinner"></div> <div>${escape_html(appState.loadingText)}</div></div></div>`);
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let spectrogramWrapperEl = void 0;
		let fileLoaded = derived(() => appState.audioBuffer !== null);
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			head("1uha8ag", $$renderer, ($$renderer) => {
				$$renderer.title(($$renderer) => {
					$$renderer.push(`<title>Peep</title>`);
				});
			});
			$$renderer.push(`<input type="file" id="fileInput" accept=".wav,audio/wav" style="display: none"/> `);
			if (!fileLoaded()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="splash"><h1>Peep</h1> <p>A web application to streamline audio editing for upload to eBird</p> <label for="fileInput" class="file-button">Open WAV File</label></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (fileLoaded()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="container"><h1>Peep</h1> <div class="file-section"><label for="fileInput" class="file-button">Open WAV File</label> <div class="file-info">${escape_html(appState.fileInfoText)}</div></div> <div class="spectrogram-section">`);
				Spectrogram($$renderer, {
					get wrapperEl() {
						return spectrogramWrapperEl;
					},
					set wrapperEl($$value) {
						spectrogramWrapperEl = $$value;
						$$settled = false;
					}
				});
				$$renderer.push(`<!----> <div class="playback-controls-container"><div class="zoom-controls"><button class="zoom-btn">−</button> <span class="zoom-level">${escape_html(appState.zoomLevel)}x</span> <button class="zoom-btn">+</button></div> `);
				PlaybackControls($$renderer, {});
				$$renderer.push(`<!----></div> `);
				Settings($$renderer, {});
				$$renderer.push(`<!----> <div class="save-section"><button class="save-btn">Save</button></div></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			LoadingOverlay($$renderer, {});
			$$renderer.push(`<!---->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
//#endregion
export { _page as default };
