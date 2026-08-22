export function sameWallet(value, address) {
  const who = String(address || "").trim().toLowerCase();
  const name = String(value || "").trim().toLowerCase();
  return Boolean(who) && who === name;
}

export function sameChartPair(value, pair) {
  if (!pair) return true;
  if (!value) return true;
  const left = String(value).replace(/\s+/g, "").toUpperCase();
  const right = String(pair).replace(/\s+/g, "").toUpperCase();
  return left === right || left.endsWith(`/${right.split("/")[1]}`);
}

export function walletChartMarks({ address, orders = [], fills = [], pair } = {}) {
  const who = String(address || "").trim();
  if (!who) return { orders: [], fills: [] };

  return {
    orders: (Array.isArray(orders) ? orders : [])
      .filter((row) => !row.account || sameWallet(row.account, who))
      .filter((row) => sameChartPair(row.pair, pair))
      .filter((row) => Number(row.price) > 0)
      .map((row) => ({
        price: Number(row.price),
        amount: Number(row.amount ?? row.base_size ?? 0),
        side: row.side === "ask" || row.side === "sell" ? "ask" : "bid",
        pair: row.pair || pair,
      })),
    fills: (Array.isArray(fills) ? fills : [])
      .filter((row) => sameWallet(row.account, who))
      .filter((row) => sameChartPair(row.pool || row.pair, pair))
      .map((row) => ({
        t: Date.parse(row.timestamp || row.t),
        price: Number(row.price) || null,
        amount: Number(row.xdx ?? row.amount ?? 0),
        side: String(row.side || "").toLowerCase() === "sell" ? "sell" : "buy",
      }))
      .filter((row) => Number.isFinite(row.t)),
  };
}
