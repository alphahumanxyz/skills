// Ambient type declarations for QuickJS built-in modules.
// Only the runner (ES module) imports these; all other harness files
// access them via globalThis._std set by the runner.

declare module "std" {
  /** Load and evaluate a script file in the global scope. */
  function loadScript(filename: string): void;
  /** Read a file as a UTF-8 string. Returns null on failure. */
  function loadFile(filename: string): string | null;
  /** Terminate the process with the given exit code. */
  function exit(code: number): never;
  /** Standard output stream. */
  const out: {
    printf(fmt: string, ...args: unknown[]): void;
    puts(str: string): void;
    flush(): void;
  };
  /** Standard error stream. */
  const err: {
    printf(fmt: string, ...args: unknown[]): void;
    puts(str: string): void;
    flush(): void;
  };
}

declare module "os" {
  /** Get the real time in milliseconds since an arbitrary epoch. */
  function now(): number;
  /** Return command-line arguments as an array. */
  const args: string[];
}
