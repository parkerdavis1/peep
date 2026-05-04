import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import { mount, unmount } from 'svelte';
import Spectrogram from './Spectrogram.svelte';
import { appState } from '$lib/state.svelte.ts';

import { tick } from 'svelte';

describe('Spectrogram Trim Markers', () => {
	let target: HTMLElement;
	let component: any;

	beforeEach(() => {
		// Reset state for each test
		appState.trimStart = 0;
		appState.trimEnd = 1;
		appState.markerPos = 0.5;
		appState.spectrogramTotalWidth = 1000;
		appState.audioBuffer = null;
		appState.spectrogramData = null;

		target = document.createElement('div');
		// Give it some dimensions so getBoundingClientRect() works reasonably
		target.style.width = '1000px';
		target.style.height = '500px';
		document.body.appendChild(target);
	});

	afterEach(() => {
		if (component) {
			unmount(component);
			component = undefined;
		}
		document.body.removeChild(target);
	});

	test('playback marker stays within bounds after dragging trim left marker', async () => {
		component = mount(Spectrogram, {
			target
		});

		// Set initial positions
		appState.markerPos = 0.5;
		appState.trimStart = 0.2;
		appState.trimEnd = 0.8;

		// Force the mock total width
		appState.spectrogramTotalWidth = 1000;

		const handleLeft = target.querySelector('.trim-handle[aria-label="Trim start"]') as HTMLElement;
		expect(handleLeft).not.toBeNull();

		// Simulate pointer down on left handle
		const pointerDownEvent = new PointerEvent('pointerdown', { pointerId: 1, bubbles: true });
		handleLeft.dispatchEvent(pointerDownEvent);
		await tick();

		const innerEl = target.querySelector('.spectrogram-inner') as HTMLElement;
		const rect = innerEl.getBoundingClientRect();
		// In tests getBoundingClientRect doesn't always have layout sizes, so let's mock it
		innerEl.getBoundingClientRect = () => ({
			left: 0,
			right: 1000,
			top: 0,
			bottom: 500,
			width: 1000,
			height: 500,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// Since standard DOM events in vitest are a bit limited and getBoundingClientRect might not work correctly,
		// we'll simulate the interaction a bit closer to how the component does it by overriding window
		// pointer move for our document
		
		// Move to 60% of width (past the markerPos of 0.5)
		const pointerMoveEvent = new PointerEvent('pointermove', {
			clientX: 600, // 0.6 * 1000, left is 0
			bubbles: true
		});
		// Dispatch on window because we attach it to <svelte:document>
		window.document.dispatchEvent(pointerMoveEvent);

		// While dragging, markerPos should NOT change
		expect(appState.markerPos).toBe(0.5);
		// But trimStart should have updated
		expect(appState.trimStart).toBeCloseTo(0.6, 2);

		// Release the drag
		const pointerUpEvent = new PointerEvent('pointerup', { bubbles: true });
		document.dispatchEvent(pointerUpEvent);

		// After release, markerPos should be snapped to the new trimStart
		expect(appState.markerPos).toBeCloseTo(0.6, 2);
	});

	test('playback marker stays within bounds after dragging trim right marker', async () => {
		component = mount(Spectrogram, {
			target
		});

		appState.markerPos = 0.5;
		appState.trimStart = 0.2;
		appState.trimEnd = 0.8;
		appState.spectrogramTotalWidth = 1000;

		const handleRight = target.querySelector('.trim-handle[aria-label="Trim end"]') as HTMLElement;
		expect(handleRight).not.toBeNull();

		// Simulate pointer down on right handle
		const pointerDownEvent = new PointerEvent('pointerdown', { pointerId: 2, bubbles: true });
		handleRight.dispatchEvent(pointerDownEvent);
		await tick();

		const innerEl = target.querySelector('.spectrogram-inner') as HTMLElement;
		const rect = innerEl.getBoundingClientRect();
		innerEl.getBoundingClientRect = () => ({
			left: 0,
			right: 1000,
			top: 0,
			bottom: 500,
			width: 1000,
			height: 500,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// Move right trim to 40% of width (past the markerPos of 0.5)
		const pointerMoveEvent = new PointerEvent('pointermove', {
			clientX: 400, // 0.4 * 1000, left is 0
			bubbles: true
		});
		// Dispatch on window because we attach it to <svelte:document>
		window.document.dispatchEvent(pointerMoveEvent);

		// While dragging, markerPos should NOT change
		expect(appState.markerPos).toBe(0.5);
		// But trimEnd should have updated
		expect(appState.trimEnd).toBeCloseTo(0.4, 2);

		// Release the drag
		const pointerUpEvent = new PointerEvent('pointerup', { bubbles: true });
		document.dispatchEvent(pointerUpEvent);

		// After release, markerPos should be snapped to the new trimEnd
		expect(appState.markerPos).toBeCloseTo(0.4, 2);
	});

	test('clicking spectrogram moves playback marker', async () => {
		component = mount(Spectrogram, {
			target
		});
		
		// The component requires elements to be bound before clicks can get rects
		await tick();

		appState.markerPos = 0.5;
		appState.trimStart = 0.0;
		appState.trimEnd = 1.0;
		appState.spectrogramTotalWidth = 1000;
		// AudioBuffer must be truthy for handleInnerClick to process
		appState.audioBuffer = new AudioBuffer({ length: 1, sampleRate: 44100 });

		const innerEl = target.querySelector('.spectrogram-inner') as HTMLElement;
		
		// Wait another tick to ensure DOM binds are settled
		await tick();
		
		// Setup mock bounding box for calculatePointerFraction
		innerEl.getBoundingClientRect = () => ({
			left: 0, right: 1000, top: 0, bottom: 500,
			width: 1000, height: 500, x: 0, y: 0, toJSON: () => {}
		});

		// Simulate click on the inner at 75% width
		const clickEvent = new MouseEvent('click', { 
			clientX: 750,
			clientY: 250,
			detail: 1, // Make sure it doesn't look like a keyboard click
			bubbles: true 
		});
		innerEl.dispatchEvent(clickEvent);
		await tick();

		expect(appState.markerPos).toBeCloseTo(0.75, 2);
	});
});