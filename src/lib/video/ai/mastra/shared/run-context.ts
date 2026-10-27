import { AsyncLocalStorage } from 'async_hooks';

export class RunContext {
  private docs = new Map<string, string>();

  write(name: string, content: string): void {
    this.docs.set(name, content);
  }

  read(name: string): string | null {
    return this.docs.get(name) ?? null;
  }

  append(name: string, content: string): void {
    const existing = this.docs.get(name) ?? '';
    this.docs.set(name, existing + '\n' + content);
  }

  readAll(): Record<string, string> {
    return Object.fromEntries(this.docs);
  }
}

export const runContextStorage = new AsyncLocalStorage<RunContext>();

export function getRunContext(): RunContext | null {
  return runContextStorage.getStore() ?? null;
}
