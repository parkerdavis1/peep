/**
 * Shared utility functions.
 */

/**
 * Format seconds as m:ss.t
 */
export function formatTime(sec) {
  if (!isFinite(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
