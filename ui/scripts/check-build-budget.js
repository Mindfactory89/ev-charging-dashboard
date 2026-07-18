import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const assetsDir = resolve("dist/assets");
const limits = { ".css": 360 * 1024, ".js": 520 * 1024 };
const files = await readdir(assetsDir);
const oversized = [];

for (const file of files) {
  const extension = Object.keys(limits).find((suffix) => file.endsWith(suffix));
  if (!extension) continue;
  const bytes = (await stat(resolve(assetsDir, file))).size;
  if (bytes > limits[extension]) oversized.push(`${file}: ${(bytes / 1024).toFixed(1)} kB`);
}

if (oversized.length) {
  console.error(`Bundle-Budget überschritten:\n${oversized.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Bundle-Budget eingehalten.");
}
