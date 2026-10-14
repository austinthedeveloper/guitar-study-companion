import { Injectable } from '@angular/core';

/** One-time messages passed between pages (e.g. "saved"); consumed on read, never persisted. */
@Injectable({ providedIn: 'root' })
export class Flash {
  private readonly pending = new Set<string>();

  set(key: string): void {
    this.pending.add(key);
  }

  consume(key: string): boolean {
    return this.pending.delete(key);
  }
}
