// src/hooks/usePrevious.ts
// Lưu lại giá trị trước của một state/prop để so sánh

import { useEffect, useRef } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
