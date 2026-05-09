export function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const sFormatted = s.toFixed(1);
  return m + ":" + sFormatted.padStart(4, "0");
}
