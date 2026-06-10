import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const allowedFiles = new Set([
  normalize("src/skins/default/tokens.css"),
  normalize("src/skins/animalIsland/tokens.css")
]);
const colorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/i;
const violations = [];

for (const filePath of collectCssFiles(path.join(root, "src"))) {
  const projectPath = normalize(path.relative(root, filePath));
  if (allowedFiles.has(projectPath)) {
    continue;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (colorPattern.test(line)) {
      violations.push(`${projectPath}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  process.stderr.write("Hard-coded CSS colors must live in skin tokens:\n");
  for (const violation of violations) {
    process.stderr.write(`${violation}\n`);
  }
  process.exit(1);
}

function collectCssFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectCssFiles(entryPath);
      }

      return entry.name.endsWith(".css") ? [entryPath] : [];
    });
}

function normalize(value) {
  return value.split(path.sep).join("/");
}
