export function isServiceNear(date: any) {
  if (!date) return false;
  const d = new Date(date);
  const diff = d.getTime() - new Date().getTime();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}
