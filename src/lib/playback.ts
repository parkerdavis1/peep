/**
 * Audio playback with live HP filter preview and marker support.
 * DOM refs (cursor, wrapper, inner) are set once via initPlayback().
 * Settings are read from appState instead of DOM inputs.
 */
import { appState } from '$lib/state.svelte.ts';
import { formatTime, applyFadeEnvelope } from '$lib/utils.ts';

// Module-level DOM refs (set from Spectrogram.svelte onMount)
let _cursor: HTMLElement | null = null;
let _wrapper: HTMLElement | null = null;
let _inner: HTMLElement | null = null;

export function initPlayback(
	cursor: HTMLElement,
	wrapper: HTMLElement,
	inner: HTMLElement
): void {
	_cursor = cursor;
	_wrapper = wrapper;
	_inner = inner;
}

/**
 * Clamp and update marker position in state.
 * The component derives pixel position from appState.markerPos.
 */
export function updateMarker(): void {
	if (!appState.audioBuffer) return;
	appState.markerPos = Math.max(
		appState.trimStart,
		Math.min(appState.trimEnd, appState.markerPos)
	);
}

export function updateTimeDisplay(currentSec?: number): void {
	if (!appState.audioBuffer) return;
	const dur = appState.audioBuffer.duration;
	const sec = currentSec ?? appState.markerPos * dur;
	const regionStart = appState.trimStart * dur;
	const regionDur = appState.trimEnd * dur - regionStart;
	appState.timeDisplayText = formatTime(sec - regionStart) + ' / ' + formatTime(regionDur);
}

export function start(): void {
	const buf = appState.audioBuffer;
	if (!buf) return;

	stop();
	appState.ensureAudioCtx();

	const ctx = appState.audioCtx!;
	const dur = buf.duration;

	let clampedMarker = appState.markerPos;
	if (!isFinite(clampedMarker) || isNaN(clampedMarker)) {
		clampedMarker = appState.trimStart;
	}
	clampedMarker = Math.max(appState.trimStart, Math.min(appState.trimEnd, clampedMarker));
	
	const startSec = clampedMarker * dur;
	const trimStartSec = appState.trimStart * dur;
	const fullRegionDur = appState.trimEnd * dur - trimStartSec;
	const remainingDur = appState.trimEnd * dur - startSec;
	const offsetInRegion = startSec - trimStartSec;

	// Guard against zero-length region (marker at trimEnd)
	if (remainingDur <= 0.01) return;

	const source = ctx.createBufferSource();
	source.buffer = buf;
	appState.sourceNode = source;

	let lastNode: AudioNode = source;

	// Live HP filter
	if (appState.hpEnabled) {
		const filter = ctx.createBiquadFilter();
		filter.type = 'highpass';
		filter.frequency.value = appState.hpFreq;
		filter.Q.value = 0.707;
		lastNode.connect(filter);
		lastNode = filter;
		appState.filterNode = filter;
	}

	// Fade in / out
	const fadeGain = ctx.createGain();
	applyFadeEnvelope(
		fadeGain,
		fullRegionDur,
		ctx.currentTime,
		appState.fadeDuration,
		appState.fadeEnabled,
		offsetInRegion
	);
	lastNode.connect(fadeGain);
	appState.fadeNode = fadeGain;

	if (appState.normalizeEnabled) {
		let peak = 0;
		for (let ch = 0; ch < buf.numberOfChannels; ch++) {
			const data = buf.getChannelData(ch);
			for (let i = 0; i < data.length; i++) {
				const abs = Math.abs(data[i]);
				if (abs > peak) peak = abs;
			}
		}
		const normalizeGain = ctx.createGain();
		if (peak > 0) normalizeGain.gain.value = Math.pow(10, -3 / 20) / peak;
		fadeGain.connect(normalizeGain);
		normalizeGain.connect(ctx.destination);
		appState.normalizeNode = normalizeGain;
	} else {
		fadeGain.connect(ctx.destination);
	}

	source.start(0, startSec, remainingDur);
	appState.playStartTime = ctx.currentTime;
	appState.playOffset = startSec;
	appState.isPlaying = true;

	// Natural end: reset marker to trimStart
	source.onended = () => {
		if (appState.sourceNode === source) {
			appState.markerPos = appState.trimStart;
			stop();
		}
	};

	if (_cursor) _cursor.style.display = 'block';
	animate();
}

/**
 * Stop playback.
 * @param savePosition  When true, saves the current playback position to appState.markerPos.
 */
export function stop(savePosition = false): void {
	if (savePosition && appState.isPlaying && appState.audioCtx && appState.audioBuffer) {
		const elapsed = appState.audioCtx.currentTime - appState.playStartTime;
		const currentSec = appState.playOffset + elapsed;
		const dur = appState.audioBuffer.duration;
		appState.markerPos = Math.max(
			appState.trimStart,
			Math.min(appState.trimEnd, currentSec / dur)
		);
	}

	appState.isPlaying = false;
	if (_cursor) _cursor.style.display = 'none';

	if (appState.animFrameId) {
		cancelAnimationFrame(appState.animFrameId);
		appState.animFrameId = null;
	}
	if (appState.sourceNode) {
		try {
			appState.sourceNode.stop();
		} catch (_) {}
		try {
			appState.sourceNode.disconnect();
		} catch (_) {}
		appState.sourceNode = null;
	}
	if (appState.filterNode) {
		try {
			appState.filterNode.disconnect();
		} catch (_) {}
		appState.filterNode = null;
	}
	if (appState.fadeNode) {
		try {
			appState.fadeNode.disconnect();
		} catch (_) {}
		appState.fadeNode = null;
	}
	if (appState.normalizeNode) {
		try {
			appState.normalizeNode.disconnect();
		} catch (_) {}
		appState.normalizeNode = null;
	}

	updateMarker();
	updateTimeDisplay();
}

export function toggle(): void {
	appState.ensureAudioCtx();
	if (appState.isPlaying) {
		stop(true);
	} else {
		start();
	}
}

export function rewind(): void {
	if (!appState.audioBuffer) return;
	const wasPlaying = appState.isPlaying;
	stop();
	appState.markerPos = appState.trimStart;
	updateMarker();
	updateTimeDisplay();
	if (wasPlaying) {
		start();
	}
}

function animate(): void {
	if (!appState.isPlaying) {
		if (_cursor) _cursor.style.display = 'none';
		return;
	}

	const ctx = appState.audioCtx!;
	const buf = appState.audioBuffer!;
	const dur = buf.duration;
	const elapsed = ctx.currentTime - appState.playStartTime;
	const currentSec = appState.playOffset + elapsed;
	const frac = currentSec / dur;

	// Update cursor position directly on the DOM element (bypasses Svelte reactivity for 60fps perf)
	if (_cursor) {
		const totalWidth =
			appState.spectrogramTotalWidth ||
			(_inner ? parseFloat(_inner.style.width) || _wrapper?.clientWidth || 0 : 0);
		_cursor.style.left = frac * totalWidth + 'px';
	}

	// Update time display (reactive state — triggers text update)
	updateTimeDisplay(currentSec);

	// Auto-scroll to keep cursor visible
	if (_wrapper && _cursor) {
		const totalWidth =
			appState.spectrogramTotalWidth ||
			parseFloat(_inner?.style.width ?? '0') ||
			_wrapper.clientWidth;
		const cursorPx = frac * totalWidth;
		const wrapperWidth = _wrapper.clientWidth;
		const scrollLeft = _wrapper.scrollLeft;
		if (cursorPx < scrollLeft || cursorPx > scrollLeft + wrapperWidth) {
			_wrapper.scrollLeft = cursorPx - wrapperWidth / 3;
		}
	}

	appState.animFrameId = requestAnimationFrame(animate);
}
