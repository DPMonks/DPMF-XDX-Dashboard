export function fullViewPriceHeight(viewportH = 0, extras = {}) {
  const chrome = 156;
  const volume = extras.volume === false ? 0 : 80;
  const rsi = extras.rsi === false ? 0 : 80;
  return Math.max(240, Math.round(Number(viewportH) || 0) - chrome - volume - rsi);
}
