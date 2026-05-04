import { sveltekit } from "@sveltejs/kit/vite";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [sveltekit()],
  css: {
    transformer: "lightningcss",
    lightningcss: {
      targets: browserslistToTargets(browserslist(">= 0.25%")),
    },
  },
  build: {
    cssMinify: "lightningcss",
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
          provider: playwright(),
          headless: true,
        },
      ],
    },
  },
});
