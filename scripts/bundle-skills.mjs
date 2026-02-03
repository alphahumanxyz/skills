/**
 * Bundle skills that have separate tool files into a single file using esbuild.
 *
 * This script uses esbuild to bundle tool files into the main skill file,
 * making them available to the V8 runtime which doesn't support ES modules.
 * Similar to bundle-telegram.mjs but for skills with tool files.
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const skillsOutDir = join(rootDir, 'skills');
const skillsSrcDir = join(rootDir, 'skills-ts-out');

// Find all skills that have a tools directory
const skills = readdirSync(skillsSrcDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

for (const skillName of skills) {
  const skillDirInput = join(skillsSrcDir, skillName);
  const skillDirOutput = join(skillsOutDir, skillName);
  const skillIndexPath = join(skillDirInput, 'index.js');
  const skillIndexPathOutput = join(skillDirOutput, 'index.js');
  const toolsDir = join(skillDirInput, 'tools');

  // Skip if index.js doesn't exist or tools directory doesn't exist
  if (!existsSync(skillIndexPath) || !existsSync(toolsDir)) {
    continue;
  }

  // Check if tools directory has any .js files
  const toolFiles = readdirSync(toolsDir)
    .filter(file => file.endsWith('.js'))
    .map(file => join(toolsDir, file));

  if (toolFiles.length === 0) {
    continue;
  }

  // Read the main skill file
  let skillCode = readFileSync(skillIndexPath, 'utf-8');

  // Check if it has import or require statements (if not, it's already bundled or doesn't need bundling)
  if (!skillCode.includes('import ') && !skillCode.includes('require(')) {
    continue;
  }

  console.log(`[bundle-skills] Bundling ${skillName} with ${toolFiles.length} tool files...`);

  try {
    // Use esbuild to bundle the skill with its tools
    // Use IIFE format and configure it to output code that can be executed directly
    const result = await esbuild.build({
      entryPoints: [skillIndexPath],
      bundle: true,
      write: true,
      format: 'iife',
      globalName: '__skill_bundle',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      sourcemap: false,
      treeShaking: true,
      // Don't add "use strict" as it prevents global assignments
      legalComments: 'none',
      banner: {
        js: '/* Bundled skill with tools */',
      },
      // Configure to handle CommonJS modules properly
      mainFields: ['browser', 'module', 'main'],
      outdir: skillDirOutput,
    });

    // if (!result.outputFiles || result.outputFiles.length === 0) {
    //   throw new Error('Failed to bundle skill');
    // }

    // let bundledCode = result.outputFiles[0].text;

    // // Remove "use strict" from the bundle to allow global variable assignments
    // bundledCode = bundledCode.replace(/^"use strict";\s*/m, '');
    // bundledCode = bundledCode.replace(/^\s*"use strict";\s*/gm, '');

    // // Fix: Ensure 'tools' is assigned to global scope
    // // The IIFE wraps everything in a module, so 'tools = [...]' inside the module
    // // needs to be assigned to globalThis.tools so the V8 runtime can access it
    // if (bundledCode.includes('tools = [')) {
    //   // Replace 'tools = [' with 'globalThis.tools = [' to assign to global scope
    //   bundledCode = bundledCode.replace(/\btools\s*=\s*\[/g, 'globalThis.tools = [');

    //   // Also create a global 'tools' variable that references globalThis.tools
    //   // This ensures tools is available as a global variable for the V8 runtime
    //   // We'll add it right after the IIFE executes
    //   const iifeEndMatch = bundledCode.match(/(var __skill_bundle\s*=\s*\(\(\)\s*=>\s*\{[\s\S]*?return require_index\(\);?\s*\}\)\(\);?)/);
    //   if (iifeEndMatch) {
    //     const iifeEnd = iifeEndMatch[0];
    //     const iifeEndIndex = bundledCode.indexOf(iifeEnd) + iifeEnd.length;
    //     // Insert code to create global tools reference after IIFE executes
    //     // Use a simple assignment that works in both strict and non-strict mode
    //     bundledCode = bundledCode.slice(0, iifeEndIndex) +
    //       '\nif (typeof globalThis.tools !== \'undefined\') { try { tools = globalThis.tools; } catch(e) { Object.defineProperty(globalThis, \'tools\', { value: globalThis.tools, writable: true, enumerable: true, configurable: true }); } }' +
    //       bundledCode.slice(iifeEndIndex);
    //   }
    // }

    // // Write the bundled file back
    // writeFileSync(skillIndexPathOutput, bundledCode);
    console.log(`[bundle-skills] Bundled ${skillName} (${(bundledCode.length / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.error(`[bundle-skills] Failed to bundle ${skillName}:`, error.message);
    if (error.errors) {
      for (const err of error.errors) {
        console.error(`  ${err.location?.file}:${err.location?.line}: ${err.text}`);
      }
    }
    // Don't exit - continue with other skills
  }
}

console.log('[bundle-skills] Bundle complete');
