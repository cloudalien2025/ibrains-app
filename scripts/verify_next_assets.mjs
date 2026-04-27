import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const buildManifestPath = path.join(rootDir, ".next", "build-manifest.json");
const staticDir = path.join(rootDir, ".next", "static");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(staticDir))) {
    throw new Error("Missing .next/static. Run `npm run build` first.");
  }

  if (!(await exists(buildManifestPath))) {
    throw new Error("Missing .next/build-manifest.json. Run `npm run build` first.");
  }

  const buildManifest = JSON.parse(await readFile(buildManifestPath, "utf8"));
  const assetPaths = [
    ...(buildManifest.polyfillFiles ?? []),
    ...(buildManifest.rootMainFiles ?? []),
    ...(buildManifest.lowPriorityFiles ?? []),
  ].filter((value) => typeof value === "string" && value.startsWith("static/"));

  if (assetPaths.length === 0) {
    throw new Error("Build manifest did not expose any static assets.");
  }

  const missingAssets = [];
  for (const relativeAssetPath of assetPaths) {
    const absoluteAssetPath = path.join(rootDir, ".next", relativeAssetPath);
    if (!(await exists(absoluteAssetPath))) {
      missingAssets.push(relativeAssetPath);
    }
  }

  if (missingAssets.length > 0) {
    throw new Error(`Missing build-manifest assets:\n${missingAssets.join("\n")}`);
  }

  const jsCount = assetPaths.filter((value) => value.endsWith(".js")).length;
  const chunkDirEntries = await readdir(path.join(staticDir, "chunks"));
  const cssCount = chunkDirEntries.filter((value) => value.endsWith(".css")).length;

  if (jsCount === 0) {
    throw new Error("Build manifest did not expose any JS assets.");
  }

  if (cssCount === 0) {
    throw new Error("Missing CSS chunks in .next/static/chunks.");
  }

  console.log(
    `Verified ${assetPaths.length} manifest-tracked static assets in .next/static (${jsCount} JS, ${cssCount} CSS).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
