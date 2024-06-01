import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/index.ts", "lib/react.tsx", "lib/reaction/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  bundle: true,
  minify: true,
  splitting: true,
  clean: true,
  dts: true,
  outDir: "dist",
});
