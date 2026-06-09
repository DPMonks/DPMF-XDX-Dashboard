// ------------------------------------------------------
// CENTRAL API BASE
// ------------------------------------------------------
const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api";

// ------------------------------------------------------
// SIMPLE HELPERS
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
// FULL API CLIENT (CLEAN + CORRECT)
// ------------------------------------------------------
export const api = {
  // CORE
  overview: () => fetch(`${API_BASE}/overview`).then(r => r.json()),
  amm: () => fetch(`${API_BASE}/amm`).then(r => r.json()),
  pools: () => fetch(`${API_BASE}/pools`).then(r => r.json()),

  // ------------------------------------------------------
  // TOKEN HOLDERS (CORRECTED FOR INFINITE SCROLL)
  // ------------------------------------------------------
  topHolders: (limit = 50, offset = 0) =>
    fetch(`${API_BASE}/top-holders?limit=${limit}&offset=${offset}`)
      .then(r => r.json()),

  holderCount: () =>
    fetch(`${API_BASE}/holders/count`)
      .then(r => r.json()),

  // ------------------------------------------------------
  // LP HOLDERS
  // ------------------------------------------------------
  topLp: (limit = 50, offset = 0) =>
    fetch(`${API_BASE}/top-lp?limit=${limit}&offset=${offset}`)
      .then(r => r.json()),

  lpHolderCount: () =>
    fetch(`${API_BASE}/lp-holders/count`)
      .then(r => r.json()),

  // ------------------------------------------------------
  // CHARTS
  // ------------------------------------------------------
  tvlHistory: () =>
    fetch(`${API_BASE}/charts/tvl`).then(r => r.json()),

  holdersHistory: () =>
    fetch(`${API_BASE}/charts/holders`).then(r => r.json()),

  lpHoldersHistory: () =>
    fetch(`${API_BASE}/charts/lp-holders`).then(r => r.json())
};
