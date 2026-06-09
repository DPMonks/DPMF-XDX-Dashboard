// ------------------------------------------------------
// CENTRAL API BASE
// ------------------------------------------------------
const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api";

// ------------------------------------------------------
// SIMPLE HELPERS (kept for backwards compatibility)
// ------------------------------------------------------
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

// ------------------------------------------------------
// FULL API CLIENT (UPDATED + PAGINATION SUPPORT)
// ------------------------------------------------------
export const api = {
  // -----------------------------
  // CORE ENDPOINTS
  // -----------------------------
  overview: () => fetch(`${API_BASE}/overview`).then(r => r.json()),
  amm: () => fetch(`${API_BASE}/amm`).then(r => r.json()),
  pools: () => fetch(`${API_BASE}/pools`).then(r => r.json()),

  // -----------------------------
  // TOKEN HOLDERS (NEW PAGINATION)
  // -----------------------------
  topHoldersPage: (page = 0, size = 50) =>
    fetch(`${API_BASE}/top-holders?limit=${size}&offset=${page * size}`)
      .then(r => r.json()),

  holderCount: () =>
    fetch(`${API_BASE}/holders/count`)
      .then(r => r.json()),

  // Backwards compatibility (still works)
  topHolders: (limit = 100) =>
    fetch(`${API_BASE}/top-holders?limit=${limit}`)
      .then(r => r.json()),

  // -----------------------------
  // LP HOLDERS (NEW PAGINATION)
  // -----------------------------
  topLpPage: (page = 0, size = 50) =>
    fetch(`${API_BASE}/top-lp?limit=${size}&offset=${page * size}`)
      .then(r => r.json()),

  lpHolderCount: () =>
    fetch(`${API_BASE}/lp-holders/count`)
      .then(r => r.json()),

  // Backwards compatibility
  topLp: (limit = 100) =>
    fetch(`${API_BASE}/top-lp?limit=${limit}`)
      .then(r => r.json()),

  // -----------------------------
  // CHART ENDPOINTS
  // -----------------------------
  tvlHistory: () =>
    fetch(`${API_BASE}/charts/tvl`).then(r => r.json()),

  holdersHistory: () =>
    fetch(`${API_BASE}/charts/holders`).then(r => r.json()),

  lpHoldersHistory: () =>
    fetch(`${API_BASE}/charts/lp-holders`).then(r => r.json())
};
