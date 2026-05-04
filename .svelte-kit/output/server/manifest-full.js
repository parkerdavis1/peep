export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","icons/apple-touch-icon.png","icons/favicon-96x96.png","icons/favicon.ico","icons/favicon.svg","icons/site.webmanifest","icons/web-app-manifest-192x192.png","icons/web-app-manifest-512x512.png"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"},
	_: {
		client: {start:"_app/immutable/entry/start.BcdVpeDM.js",app:"_app/immutable/entry/app.PJuKTBP_.js",imports:["_app/immutable/entry/start.BcdVpeDM.js","_app/immutable/chunks/DdroFTN2.js","_app/immutable/chunks/CAxJj--k.js","_app/immutable/entry/app.PJuKTBP_.js","_app/immutable/chunks/CAxJj--k.js","_app/immutable/chunks/Dj6f-nJM.js","_app/immutable/chunks/DEDqjojZ.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
