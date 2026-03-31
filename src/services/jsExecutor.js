import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT = 30000;

export class JsExecutor {
  #timeout;

  constructor({ timeout = DEFAULT_TIMEOUT } = {}) {
    this.#timeout = timeout;
  }

  /**
   * Execute JavaScript code in a sandboxed context.
   * @param {string} code - JavaScript code to execute
   * @param {object} injections - Objects to inject (connection, oracledb)
   * @returns {Promise<{ output?, logs?, error?, duration }>}
   */
  async execute(code, injections = {}) {
    const start = performance.now();
    const logs = [];

    try {
      // Block dangerous patterns before execution
      if (/\bimport\s*\(/.test(code)) {
        throw new Error('Dynamic import is not allowed');
      }

      const sandbox = {
        console: Object.freeze({
          log: (...args) => logs.push(args.map(String).join(' ')),
          warn: (...args) => logs.push(args.map(String).join(' ')),
          error: (...args) => logs.push(args.map(String).join(' ')),
        }),
        // Inject provided objects
        ...injections,
        // Freeze dangerous globals to undefined
        require: undefined,
        process: undefined,
        globalThis: undefined,
        global: undefined,
      };

      const context = vm.createContext(sandbox);

      // Wrap in async function to support await.
      // Try to auto-return the last expression so users don't need explicit return.
      const trimmedCode = code.trim().replace(/;\s*$/, '');
      // Find the last semicolon that's not inside a string or parens to split
      const lastSemi = trimmedCode.lastIndexOf(';');
      let wrappedCode;
      if (lastSemi === -1) {
        // Single statement — check if it's an expression
        const isStatement =
          /^(if|for|while|switch|try|throw|const|let|var|function|class|return)\b/.test(
            trimmedCode,
          );
        wrappedCode = isStatement ? trimmedCode : `return (${trimmedCode})`;
      } else {
        const prefix = trimmedCode.substring(0, lastSemi + 1);
        const lastExpr = trimmedCode.substring(lastSemi + 1).trim();
        if (
          lastExpr &&
          !/^(if|for|while|switch|try|throw|const|let|var|function|class|return)\b/.test(lastExpr)
        ) {
          wrappedCode = `${prefix} return (${lastExpr});`;
        } else {
          wrappedCode = trimmedCode;
        }
      }

      const wrapped = `(async () => { ${wrappedCode} })()`;
      const script = new vm.Script(wrapped);

      const output = await script.runInContext(context, {
        timeout: this.#timeout,
      });

      const duration = Math.round(performance.now() - start);
      return { output, logs, duration };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      let message = err.message;
      if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        message = 'Execution timed out';
      }
      return { error: message, logs, duration };
    }
  }
}
