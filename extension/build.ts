import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build, type BuildOptions } from "esbuild";

const outdir = "dist";

const contentEntryPoints: Record<string, string> = {
  "lc-content": "src/content/leetcode.ts",
  "lc-main": "src/content/leetcode-main.ts",
  "gfg-content": "src/content/gfg.ts",
  "hr-content": "src/content/hackerrank.ts",
};

const esmEntryPoints: Record<string, string> = {
  background: "src/background/service-worker.ts",
  popup: "src/popup/popup.ts",
};

const sharedOptions: BuildOptions = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  minify: false,
};

async function copyStaticFile(from: string, to: string): Promise<void> {
  const target = resolve(outdir, to);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(from, target);
}

async function main(): Promise<void> {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const contentBuilds = Object.entries(contentEntryPoints).map(([name, entryPoint]) =>
    build({
      ...sharedOptions,
      format: "iife",
      entryPoints: [entryPoint],
      outfile: resolve(outdir, `${name}.js`),
    })
  );

  const esmBuilds = Object.entries(esmEntryPoints).map(([name, entryPoint]) =>
    build({
      ...sharedOptions,
      format: "esm",
      entryPoints: [entryPoint],
      outfile: resolve(outdir, `${name}.js`),
    })
  );

  await Promise.all([...contentBuilds, ...esmBuilds]);

  await Promise.all([
    copyStaticFile("src/popup/popup.html", "popup.html"),
    copyStaticFile("src/popup/popup.css", "popup.css"),
  ]);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
