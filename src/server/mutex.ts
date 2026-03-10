/** Promise-chain based per-page mutex for serializing Read-Modify-Write operations. */
export class PageMutex {
  private chains = new Map<string, Promise<void>>();

  async acquire(date: string): Promise<() => void> {
    const prev = this.chains.get(date) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prev.then(() => next);
    this.chains.set(date, tail);
    await prev;
    return () => {
      release();
      // Clean up entry if no other waiters have chained after us
      if (this.chains.get(date) === tail) {
        this.chains.delete(date);
      }
    };
  }
}
