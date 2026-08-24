import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook que retorna un valor "debounced" — solo se actualiza después de que 
 * el usuario deje de cambiar el valor durante `delay` ms.
 * 
 * Uso típico: filtrar listas locales sin re-renderizar en cada tecla.
 */
export function useDebounceValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook que retorna una función "debounced" — llama al callback original
 * solo después de `delay` ms sin nuevas invocaciones.
 * 
 * Uso típico: búsquedas asíncronas (API calls) en cada tecla.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Mantener referencia actualizada al callback sin re-crear la función debounced
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}
