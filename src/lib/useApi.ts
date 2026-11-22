import { useEffect, useState } from 'react';

const responseCache = new Map<string, unknown>();

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(
    () => (responseCache.get(url) as T | undefined) ?? null,
  );
  const [loading, setLoading] = useState<boolean>(() => !responseCache.has(url));
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (reloadTick === 0 && responseCache.has(url)) {
      setData(responseCache.get(url) as T);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
        }
        return (await res.json()) as T;
      })
      .then((json) => {
        if (cancelled) return;
        responseCache.set(url, json);
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, reloadTick]);

  return {
    data,
    loading,
    error,
    refresh: () => setReloadTick((n) => n + 1),
  };
}