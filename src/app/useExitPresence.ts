import { useEffect, useRef, useState } from 'react';

/**
 * Presence untuk animasi KELUAR elemen DOM yang dirender kondisional.
 *
 * React menghapus node seketika saat kondisi render mati — hook ini
 * menahan node tetap ter-mount selama durasi exit (kelas .hud-exit /
 * .hud-exit-slide dari index.css) lalu melepasnya. Disiplin cleanup
 * meniru pola gsap.context().revert(): setiap timeout dibersihkan
 * pada perubahan dependensi DAN saat komponen induk unmount, jadi
 * tidak ada timer yatim atau setState pada node yang sudah lepas.
 *
 * prefers-reduced-motion (gerbang JS, pola matchMedia skill
 * accessible-animation): exit menjadi 0ms — elemen pergi seketika
 * tanpa gerakan, selaras dengan gerbang CSS global di index.css.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useExitPresence(
  show: boolean,
  exitMs = 150,
): { mounted: boolean; exiting: boolean } {
  const [mounted, setMounted] = useState(show);
  const [exiting, setExiting] = useState(false);
  const mountedRef = useRef(show);

  useEffect(() => {
    if (show) {
      mountedRef.current = true;
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mountedRef.current) return;
    setExiting(true);
    const ms = prefersReducedMotion() ? 0 : exitMs;
    const timer = window.setTimeout(() => {
      mountedRef.current = false;
      setMounted(false);
      setExiting(false);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [show, exitMs]);

  return { mounted, exiting };
}
