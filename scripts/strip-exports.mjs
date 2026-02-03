// Post-compilation step: strips `export {};` from compiled JS files and
// converts 4-space indentation to 2-space to match project style.
//
// Needed because skill .ts files use `export {}` to create module scope
// (isolating each skill's top-level declarations), but the QuickJS runtime
// evaluates scripts via ctx.eval() which doesn't support ES module syntax.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let count = 0;

for (const parent of ["skills", "examples"]) {
  const dir = join(root, parent);
  if (!existsSync(dir)) continue;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const jsFile = join(dir, entry.name, "index.js");
    if (!existsSync(jsFile)) continue;

    let content = readFileSync(jsFile, "utf8");

    // Strip `export {};` lines (module boundary marker)
    content = content.replace(/^export\s*\{\s*\}\s*;?\s*$/gm, "");

    // Convert 4-space indentation to 2-space
    content = content.replace(/^( +)/gm, (match) =>
      " ".repeat(Math.floor(match.length / 2))
    );

    // Clean up trailing blank lines
    content = content.trimEnd() + "\n";

    writeFileSync(jsFile, content);
    count++;
  }
}

console.log(`Processed ${count} skill(s)`);
