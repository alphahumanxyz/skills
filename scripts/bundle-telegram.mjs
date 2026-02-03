/**
 * Bundle the telegram skill with its dependencies using esbuild.
 *
 * The telegram skill uses the `telegram` (gram.js) npm package which
 * needs to be bundled into a single file for the V8 runtime.
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const telegramSkillPath = join(rootDir, 'skills', 'telegram', 'index.js');

// Only bundle if the telegram skill was compiled
if (!existsSync(telegramSkillPath)) {
  console.log('[bundle-telegram] No telegram skill found, skipping bundle');
  process.exit(0);
}

console.log('[bundle-telegram] Bundling telegram skill with dependencies...');

try {
  // Read the compiled skill
  const skillCode = readFileSync(telegramSkillPath, 'utf-8');

  // Check if it imports telegram package
  if (!skillCode.includes('telegram') && !skillCode.includes('TelegramClient')) {
    console.log('[bundle-telegram] Skill does not use telegram package, skipping');
    process.exit(0);
  }

  // Bundle with esbuild
  const result = await esbuild.build({
    entryPoints: [telegramSkillPath],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: '__telegramSkill',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: false,
    // Define globals that are provided by the V8 runtime
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    // External modules that are provided by the V8 runtime
    external: [],
    // Inject polyfills for Node.js APIs
    inject: [],
    // Handle Node.js built-ins
    alias: {
      'path': join(__dirname, 'polyfills', 'path.js'),
      'fs': join(__dirname, 'polyfills', 'fs.js'),
      'os': join(__dirname, 'polyfills', 'os.js'),
      'net': join(__dirname, 'polyfills', 'net.js'),
      'tls': join(__dirname, 'polyfills', 'tls.js'),
      'stream': join(__dirname, 'polyfills', 'stream.js'),
      'events': join(__dirname, 'polyfills', 'events.js'),
      'buffer': join(__dirname, 'polyfills', 'buffer.js'),
      'util': join(__dirname, 'polyfills', 'util.js'),
      'crypto': join(__dirname, 'polyfills', 'crypto.js'),
    },
  });

  if (result.outputFiles && result.outputFiles.length > 0) {
    const bundledCode = result.outputFiles[0].text;
    writeFileSync(telegramSkillPath, bundledCode);
    console.log(`[bundle-telegram] Bundled successfully (${(bundledCode.length / 1024).toFixed(1)} KB)`);
  }
} catch (error) {
  console.error('[bundle-telegram] Bundle failed:', error.message);
  // Don't fail the build - the skill might work without bundling
  // if it doesn't actually use the telegram package
}
