import { mdsvex } from "mdsvex";
import adapter from "@sveltejs/adapter-static";

export default {
  kit: {
    adapter: adapter({
      pages: "dist",
      assets: "dist",
      fallback: "index.html",
      precompress: false,
      strict: true,
    }),
  },
  preprocess: [mdsvex({ extensions: [".svx", ".md"] })],
  extensions: [".svelte", ".svx", ".md"],
};
