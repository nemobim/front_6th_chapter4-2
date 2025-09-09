import { useCallback, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export const useAutoCallback = (callback: AnyFunction) => {
  const ref = useRef(callback);
  ref.current = callback;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback((...args: any[]) => {
    return ref.current(...args);
  }, []);
};
