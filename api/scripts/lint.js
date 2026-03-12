const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const includeExtensions = new Set([".js"]);
const ignoredDirectories = new Set(["node_modules", "prisma", "test"]);

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

const files = collectFiles(rootDir);

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

process.stdout.write(`API lint passed for ${files.length} files.\n`);
