import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const includeExtensions = new Set([".js", ".jsx"]);
const ignoredDirectories = new Set(["node_modules", "dist", "test"]);
const bannedPatterns = [
  { pattern: /\balert\s*\(/, label: "alert()" },
  { pattern: /\bconfirm\s*\(/, label: "confirm()" },
];

function collectFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (includeExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = [
  ...collectFiles(path.join(rootDir, "src")),
  path.join(rootDir, "vite.config.js"),
];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const loader = path.extname(file) === ".jsx" ? "jsx" : "js";

  await transform(source, {
    loader,
    format: "esm",
    target: "es2022",
    sourcemap: false,
  });

  for (const rule of bannedPatterns) {
    if (rule.pattern.test(source)) {
      throw new Error(`${rule.label} is not allowed in ${path.relative(rootDir, file)}`);
    }
  }
}

process.stdout.write(`UI lint passed for ${files.length} files.\n`);
