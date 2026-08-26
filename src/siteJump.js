export const SITE_JUMP_IDS = [
  "wallet",
  "details",
  "trading",
  "swap",
  "orderbook",
  "activity",
  "holders",
  "lp-owners",
  "create-pool",
  "pools",
  "governance",
];

export function siteJumpItems(t = {}) {
  return [
    { id: "wallet", short: t.jumpWallet || "Wallet", label: t.connectedWallet || "Connected Wallet" },
    { id: "details", short: t.jumpDetails || "Details", label: t.tokenDetails || "XDX Details" },
    { id: "trading", short: t.jumpTrading || "Trade chart", label: t.tradingChart || "XDX Trading Chart" },
    { id: "swap", short: t.jumpSwap || "Smart Swap", label: t.swapTitle || "XDX Smart Swap" },
    { id: "orderbook", short: t.jumpBook || "Order book", label: t.orderbook || "XDX Order Book" },
    { id: "activity", short: t.jumpActivity || "Activity", label: t.activityChart || "XDX Activity" },
    { id: "holders", short: t.jumpHolders || "Rich list", label: t.topHolders || "XDX Rich list" },
    { id: "lp-owners", short: t.jumpLp || "LP owners", label: t.lpHolders || "XDX Lp Owners" },
    { id: "create-pool", short: t.jumpCreate || "Create pool", label: t.createPoolTitle || "Create New XDX Pool" },
    { id: "pools", short: t.jumpPools || "AMM pools", label: t.ammPools || "AMM Pools" },
    { id: "governance", short: t.jumpVote || "Vote", label: t.poolGovernance || "Pool Governance Voting" },
  ];
}

export function readJumpHash(hash) {
  const id = String(hash || "")
    .replace(/^#/, "")
    .trim();
  return SITE_JUMP_IDS.includes(id) ? id : "";
}

export function pageTravelPercent(scrollY, maxScroll) {
  const top = Number(scrollY) || 0;
  const max = Number(maxScroll);
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, (top / max) * 100));
}

export function jumpLockOffset({ barH = 0, safeTop = 0, gap = 0 } = {}) {
  return Math.round(
    Math.max(0, Number(barH) || 0) + Math.max(0, Number(safeTop) || 0) + Math.max(0, Number(gap) || 0)
  );
}

export function trailChromeOffset({ headerH = 0, barH = 0, padTop = 0 } = {}) {
  void headerH;
  return jumpLockOffset({ barH, safeTop: padTop, gap: 0 });
}

export function sectionAtLockLine(ids = SITE_JUMP_IDS, offset = 72, lookup = globalThis.document?.getElementById?.bind(globalThis.document)) {
  if (typeof lookup !== "function") return ids[0];
  let current = ids[0];
  for (const id of ids) {
    const node = lookup(id);
    if (!node?.getBoundingClientRect) continue;
    if (node.getBoundingClientRect().top - offset <= 1) current = id;
  }
  return current;
}
