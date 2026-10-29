import { useEffect, useState } from "react";

/** Bir değeri belirtilen süre boyunca değişmezse "yayınlar". Arama input'ları için. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}