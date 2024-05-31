import dts from "bun-plugin-dts";

await Bun.build({
  entrypoints: ["lib/index.ts", "lib/react.tsx"],
  outdir: "dist",
  minify: true,
  splitting: true,
  external: ["react"],
  plugins: [dts()],
});
