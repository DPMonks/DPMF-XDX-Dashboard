export function changeDirection(previous, next) {
  const from = Number(previous);
  const to = Number(next);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to === from) return null;
  return to > from ? "up" : "down";
}
