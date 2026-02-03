/**
 * Bundle the telegram skill with gramjs dependencies using esbuild.
 *
 * The telegram skill uses gramjs which requires Node.js APIs.
 * This script bundles gramjs from the npm 'telegram' package with polyfills for the V8 runtime.
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const telegramOutDir = join(rootDir, 'skills', 'telegram');
const telegramSkillPath = join(telegramOutDir, 'index.js');

// Only bundle if the telegram skill was compiled
if (!existsSync(telegramSkillPath)) {
  console.log('[bundle-telegram] No compiled telegram skill found, skipping bundle');
  process.exit(0);
}

console.log('[bundle-telegram] Bundling telegram skill with gramjs and polyfills...');

const polyfillsDir = join(__dirname, 'polyfills');

try {
  // Ensure output directory exists
  if (!existsSync(telegramOutDir)) {
    mkdirSync(telegramOutDir, { recursive: true });
  }

  // Bundle gramjs from the 'telegram' npm package
  console.log('[bundle-telegram] Step 1: Bundling gramjs library from npm package...');

  const gramjsBundleResult = await esbuild.build({
    entryPoints: ['telegram'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'GramJS',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: false,
    treeShaking: true,
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import', 'default'],
    // Define globals
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
      'process.browser': 'true',
    },
    // Inject Buffer globally
    inject: [join(polyfillsDir, 'buffer-inject.js')],
    // Map Node.js modules to polyfills
    alias: {
      'buffer': join(polyfillsDir, 'buffer.js'),
      'crypto': join(polyfillsDir, 'crypto.js'),
      'events': join(polyfillsDir, 'events.js'),
      'async-mutex': join(polyfillsDir, 'async-mutex.js'),
      'websocket': join(polyfillsDir, 'websocket.js'),
      'store2': join(polyfillsDir, 'store2.js'),
      'big-integer': join(polyfillsDir, 'big-integer.js'),
      'path': join(polyfillsDir, 'path.js'),
      'fs': join(polyfillsDir, 'fs.js'),
      'os': join(polyfillsDir, 'os.js'),
      'net': join(polyfillsDir, 'net.js'),
      'tls': join(polyfillsDir, 'tls.js'),
      'stream': join(polyfillsDir, 'stream.js'),
      'util': join(polyfillsDir, 'util.js'),
      'socks': join(polyfillsDir, 'socks.js'),
      'ts-custom-error': join(polyfillsDir, 'ts-custom-error.js'),
      '@cryptography/aes': join(polyfillsDir, 'cryptography-aes.js'),
      'htmlparser2': join(polyfillsDir, 'htmlparser2.js'),
      'node-localstorage': join(polyfillsDir, 'node-localstorage.js'),
      'pako': join(polyfillsDir, 'pako.js'),
      'mime': join(polyfillsDir, 'mime.js'),
    },
  });

  if (!gramjsBundleResult.outputFiles || gramjsBundleResult.outputFiles.length === 0) {
    throw new Error('Failed to bundle gramjs');
  }

  let gramjsBundleCode = gramjsBundleResult.outputFiles[0].text;

  // Remove "use strict" from the bundle to allow global variable assignments
  // in the skill code (tools, init, start, etc. are assigned without declaration)
  gramjsBundleCode = gramjsBundleCode.replace(/^"use strict";\s*/m, '');
  gramjsBundleCode = gramjsBundleCode.replace(/^\s*"use strict";\s*/gm, '');

  console.log(`[bundle-telegram] gramjs bundle size: ${(gramjsBundleCode.length / 1024).toFixed(1)} KB`);

  // Write gramjs bundle
  const gramjsBundlePath = join(telegramOutDir, 'gramjs-bundle.js');
  writeFileSync(gramjsBundlePath, gramjsBundleCode);
  console.log(`[bundle-telegram] Wrote gramjs bundle to: gramjs-bundle.js`);

  // Now read and update the main telegram skill to include the gramjs bundle
  console.log('[bundle-telegram] Step 2: Updating telegram skill...');

  let skillCode = readFileSync(telegramSkillPath, 'utf-8');

  // The skill code should work as-is since it declares GramJS as a global
  // We just need to prepend the gramjs bundle to make GramJS available

  // Create the final bundled skill file
  const finalCode = `// Bundled telegram skill with gramjs
${gramjsBundleCode}

// Main skill code
${skillCode}
`;

  writeFileSync(telegramSkillPath, finalCode);
  console.log(`[bundle-telegram] Final bundle size: ${(finalCode.length / 1024).toFixed(1)} KB`);

  console.log('[bundle-telegram] Bundle complete');
} catch (error) {
  console.error('[bundle-telegram] Bundle failed:', error.message);
  if (error.errors) {
    for (const err of error.errors) {
      console.error(`  ${err.location?.file}:${err.location?.line}: ${err.text}`);
    }
  }
  // Log full error for debugging
  console.error(error);
  process.exit(1);
}
