/** FIFO cache for processed message IDs to ensure idempotent handling. */
export class IdempotencyCache {
  private cache = new Map<string, unknown>();
  private readonly maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  get(id: string): unknown {
    return this.cache.get(id);
  }

  set(id: string, response: unknown): void {
    // Evict oldest entry if at capacity (Map preserves insertion order)
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }
    this.cache.set(id, response);
  }
}
