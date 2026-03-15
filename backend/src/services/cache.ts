export function createTtlCache<T>(ttlMs: number) {
  let value: T | null = null;
  let expiresAt = 0;
  let inflight: Promise<T> | null = null;

  return {
    async get(loader: () => Promise<T>, force = false): Promise<T> {
      const now = Date.now();
      if (!force && value !== null && now < expiresAt) {
        return value;
      }

      if (inflight) {
        return inflight;
      }

      inflight = loader()
        .then((next) => {
          value = next;
          expiresAt = Date.now() + ttlMs;
          return next;
        })
        .finally(() => {
          inflight = null;
        });

      return inflight;
    },
    clear() {
      value = null;
      expiresAt = 0;
      inflight = null;
    },
  };
}
