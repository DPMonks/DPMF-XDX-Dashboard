// Central API base
const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api/public";

// -----------------------------
// EXISTING FUNCTIONS (kept)
// -----------------------------
export async function getTVL() {
  const res = await fetch(`${API_BASE}/overview`);
  const data = await res.json();
  return data.tvl;
}

export async function getHolders() {
  const res = await fetch(`${API_BASE}/overview`);
  const data = await res.json();
  return data.holder_count;
}

export async function getAMM() {
  const res = await fetch(`${API_BASE}/amm`);
  return res.json();
}

// -----------------------------
// NEW FULL API CLIENT
// -----------------------------
export const api = {
  overview: () => fetch(`${API_BASE}/overview`).then(r => r.json()),
  amm: () => fetch(`${API_BASE}/amm`).then(r => r.json()),
  pools: () => fetch(`${API_BASE}/pools`).then(r => r.json()),

  topHolders: (limit = 100) =>
    fetch(`${API_BASE}/top-holders?limit=${limit}`).then(r => r.json()),

  topLp: (limit = 100) =>
    fetch(`${API_BASE}/top-lp?limit=${limit}`).then(r => r.json()),

  tvlHistory: () =>
    fetch(`${API_BASE}/charts/tvl`).then(r => r.json()),

  holdersHistory: () =>
    fetch(`${API_BASE}/charts/holders`).then(r => r.json()),

  lpHoldersHistory: () =>
    fetch(`${API_BASE}/charts/lp-holders`).then(r => r.json())
};
