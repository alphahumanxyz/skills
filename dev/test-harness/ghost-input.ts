/**
 * ghost-input.ts - Fish shell-style ghost text suggestions for the REPL
 *
 * Replaces readline.question() with a custom raw-mode keypress handler that
 * renders dim ANSI ghost suggestions inline after the cursor. Accept them
 * with Tab or Right arrow.
 */

import * as readlineSync from 'readline';
import * as readline from 'readline/promises';

// ─── Types ──────────────────────────────────────────────────────────

export interface SuggestionSource {
  /** Return the suffix to show as ghost text, or null if no suggestion. */
  suggest(line: string): string | null;
}

export interface GhostInputOptions {
  prompt: string;
  sources: SuggestionSource[];
}

export interface GhostInput {
  /** Prompt for a line of input with ghost text suggestions. */
  question(): Promise<string>;
  /** Clear the line, run writeFn, then re-render the prompt. */
  interruptForLog(writeFn: () => void): void;
  /** Whether a question() call is currently active. */
  readonly isActive: boolean;
  /** Clean up resources. */
  destroy(): void;
}

// ─── ANSI helpers ───────────────────────────────────────────────────

const ESC = '\x1b';
const CLEAR_LINE = `${ESC}[2K\r`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;

// ─── Factory ────────────────────────────────────────────────────────

export function createGhostInput(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
  options: GhostInputOptions,
): GhostInput {
  const { prompt, sources } = options;

  let active = false;
  let destroyed = false;

  // Current line editing state (only meaningful while active)
  let buf = '';
  let cursor = 0;
  let ghost = '';
  let resolveFn: ((line: string) => void) | null = null;

  // ─── Rendering ──────────────────────────────────────────────────

  function computeGhost(): string {
    // Only suggest when cursor is at end of input
    if (cursor !== buf.length) return '';
    for (const src of sources) {
      const suggestion = src.suggest(buf);
      if (suggestion) return suggestion;
    }
    return '';
  }

  function render(): void {
    ghost = computeGhost();
    // Clear line and redraw: prompt + user text + dim ghost
    stdout.write(CLEAR_LINE);
    stdout.write(prompt + buf);
    if (ghost) {
      stdout.write(DIM + ghost + RESET);
    }
    // Reposition cursor to actual editing position
    const totalAfterCursor = (buf.length - cursor) + ghost.length;
    if (totalAfterCursor > 0) {
      stdout.write(`${ESC}[${totalAfterCursor}D`);
    }
  }

  // ─── Keypress handler ───────────────────────────────────────────

  function onKeypress(_ch: string | undefined, key: readlineSync.Key | undefined): void {
    if (!active) return;

    // Handle special keys via key.name / key.sequence
    const name = key?.name;
    const ctrl = key?.ctrl ?? false;
    const meta = key?.meta ?? false;
    const seq = key?.sequence ?? '';

    // Ctrl+C: clear line or signal interrupt
    if (ctrl && name === 'c') {
      if (buf.length > 0) {
        buf = '';
        cursor = 0;
        render();
      } else {
        // Signal interrupt on empty line
        stdout.write('\n');
        finish('');
        // Also signal to the process that Ctrl+C was pressed on empty
        process.emit('SIGINT' as never);
      }
      return;
    }

    // Ctrl+D: EOF on empty line
    if (ctrl && name === 'd') {
      if (buf.length === 0) {
        stdout.write('\n');
        finish(null as unknown as string);
      }
      return;
    }

    // Enter: submit
    if (name === 'return') {
      stdout.write('\n');
      finish(buf);
      return;
    }

    // Tab: accept ghost text (or do nothing if no ghost)
    if (name === 'tab') {
      if (ghost && cursor === buf.length) {
        buf += ghost;
        cursor = buf.length;
        render();
      }
      return;
    }

    // Right arrow: accept ghost if at end, else move cursor
    if (name === 'right') {
      if (cursor === buf.length && ghost) {
        buf += ghost;
        cursor = buf.length;
        render();
      } else if (cursor < buf.length) {
        cursor++;
        render();
      }
      return;
    }

    // Left arrow
    if (name === 'left') {
      if (cursor > 0) {
        cursor--;
        render();
      }
      return;
    }

    // Home / Ctrl+A
    if (name === 'home' || (ctrl && name === 'a')) {
      cursor = 0;
      render();
      return;
    }

    // End / Ctrl+E
    if (name === 'end' || (ctrl && name === 'e')) {
      cursor = buf.length;
      render();
      return;
    }

    // Backspace
    if (name === 'backspace') {
      if (cursor > 0) {
        buf = buf.slice(0, cursor - 1) + buf.slice(cursor);
        cursor--;
        render();
      }
      return;
    }

    // Delete
    if (name === 'delete') {
      if (cursor < buf.length) {
        buf = buf.slice(0, cursor) + buf.slice(cursor + 1);
        render();
      }
      return;
    }

    // Ctrl+U: kill line before cursor
    if (ctrl && name === 'u') {
      buf = buf.slice(cursor);
      cursor = 0;
      render();
      return;
    }

    // Ctrl+K: kill line after cursor
    if (ctrl && name === 'k') {
      buf = buf.slice(0, cursor);
      render();
      return;
    }

    // Ctrl+W: kill word before cursor
    if (ctrl && name === 'w') {
      if (cursor > 0) {
        let i = cursor - 1;
        // skip trailing spaces
        while (i > 0 && buf[i - 1] === ' ') i--;
        // skip word characters
        while (i > 0 && buf[i - 1] !== ' ') i--;
        buf = buf.slice(0, i) + buf.slice(cursor);
        cursor = i;
        render();
      }
      return;
    }

    // Ctrl+L: clear screen, re-render
    if (ctrl && name === 'l') {
      stdout.write(`${ESC}[2J${ESC}[H`);
      render();
      return;
    }

    // Up/Down arrows: ignore (no history for now)
    if (name === 'up' || name === 'down') {
      return;
    }

    // Ignore other ctrl/meta combos
    if (ctrl || meta) return;

    // Regular character input
    if (seq && seq.length === 1 && seq.charCodeAt(0) >= 32) {
      buf = buf.slice(0, cursor) + seq + buf.slice(cursor);
      cursor++;
      render();
      return;
    }

    // Multi-byte characters (emoji, unicode)
    if (seq && seq.length > 1 && !name) {
      buf = buf.slice(0, cursor) + seq + buf.slice(cursor);
      cursor += seq.length;
      render();
      return;
    }
  }

  function finish(line: string): void {
    if (!active) return;
    active = false;
    ghost = '';

    // Exit raw mode and remove listener
    if (stdin.isTTY && stdin.isRaw) {
      stdin.setRawMode(false);
    }
    stdin.removeListener('keypress', onKeypress);

    if (resolveFn) {
      const fn = resolveFn;
      resolveFn = null;
      fn(line);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  function question(): Promise<string> {
    if (destroyed) return Promise.reject(new Error('GhostInput destroyed'));

    // Non-TTY fallback: use plain readline
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      return rl.question(prompt).finally(() => rl.close());
    }

    return new Promise<string>((resolve, reject) => {
      active = true;
      buf = '';
      cursor = 0;
      ghost = '';
      resolveFn = resolve;

      // Enable raw mode and keypress events
      readlineSync.emitKeypressEvents(stdin);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('keypress', onKeypress);

      // Initial render (just the prompt)
      render();
    });
  }

  function interruptForLog(writeFn: () => void): void {
    if (!active) {
      writeFn();
      return;
    }
    // Clear current line, write the log, then re-render
    stdout.write(CLEAR_LINE);
    writeFn();
    render();
  }

  return {
    question,
    interruptForLog,
    get isActive() { return active; },
    destroy() {
      destroyed = true;
      if (active) finish('');
    },
  };
}
