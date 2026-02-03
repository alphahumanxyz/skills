/**
 * Bundle skills that have separate tool files into a single file using esbuild.
 *
 * This script uses esbuild to bundle tool files into the main skill file,
 * making them available to the V8 runtime which doesn't support ES modules.
 * Similar to bundle-telegram.mjs but for skills with tool files.
 */
import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const skillsOutDir = join(rootDir, 'skills');
const skillsSrcDir = join(rootDir, 'skills-ts-out');

// Footer code that exposes the bundled skill object to globalThis.__skill
// The V8 runtime will access the skill via globalThis.__skill.default
const SKILL_FOOTER = `
// Expose skill bundle to globalThis for V8 runtime access
globalThis.__skill = __skill_bundle;
`;

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
      write: false, // Don't write directly, we need to append footer
      format: 'iife',
      globalName: '__skill_bundle',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      sourcemap: false,
      treeShaking: true,
      // Don't add "use strict" as it prevents global assignments
      legalComments: 'none',
      banner: { js: '/* Bundled skill with esbuild */' },
      // Configure to handle CommonJS modules properly
      mainFields: ['module', 'main'],
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('esbuild did not produce output');
    }

    let bundledCode = result.outputFiles[0].text;

    // Append footer that exposes skill functions to globalThis
    bundledCode = bundledCode + SKILL_FOOTER;

    // Ensure output directory exists
    if (!existsSync(skillDirOutput)) {
      mkdirSync(skillDirOutput, { recursive: true });
    }

    // Write the bundled file
    writeFileSync(skillIndexPathOutput, bundledCode);

    console.log(
      `[bundle-skills] Bundled ${skillName} (${(bundledCode.length / 1024).toFixed(1)} KB)`
    );
  } catch (error) {
    console.error(`[bundle-skills] Failed to bundle ${skillName}:`, error.message, error);
    if (error.errors) {
      for (const err of error.errors) {
        console.error(`  ${err.location?.file}:${err.location?.line}: ${err.text}`);
      }
    }
    // Don't exit - continue with other skills
  }
}

console.log('[bundle-skills] Bundle complete');
