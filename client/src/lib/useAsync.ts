import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);

  const load = useCallback(() => {
    const id = ++run.current;
    setLoading(true);
    fn()
      .then((d) => {
        if (id === run.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => id === run.current && setError(e.message))
      .finally(() => id === run.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(load, [load]);
  return { data, error, loading, reload: load, setData };
}
