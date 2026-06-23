/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const SHARE_TARGET_CACHE = 'share-target-v1';
const SHARED_AUDIO_KEY = '/shared-audio';

self.addEventListener('install', () => {
	// Activate immediately without waiting for existing tabs to close
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	// Take control of all clients immediately
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only intercept POST requests to the share target action URL
	if (url.pathname !== '/share-target/' || event.request.method !== 'POST') {
		return;
	}

	event.respondWith(
		(async () => {
			const formData = await event.request.formData();
			const audioFile = formData.get('audio');

			if (audioFile instanceof File) {
				const cache = await caches.open(SHARE_TARGET_CACHE);
				await cache.put(
					SHARED_AUDIO_KEY,
					new Response(audioFile, {
						headers: {
							'Content-Type': audioFile.type || 'audio/wav',
							'X-File-Name': audioFile.name
						}
					})
				);
			}

			return Response.redirect('/', 303);
		})()
	);
});
