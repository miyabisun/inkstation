import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "$client": resolve("./src/client"),
      "$shared": resolve("./src/shared"),
    },
  },
  build: {
    outDir: "dist",
  },
});
