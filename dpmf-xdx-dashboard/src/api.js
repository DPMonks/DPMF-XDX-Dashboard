// src/api.js

const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api";

export const api = {
  overview: () => fetch(`${API_BASE}/overview`).then(r => r.json()),
  amm: () => fetch(`${API_BASE}/amm`).then(r => r.json()),
  pools: () => fetch(`${API_BASE}/pools`).then(r => r.json()),
  topHolders: (limit = 100) =>
    fetch(`${API_BASE}/top-holders?limit=${limit}`).then(r => r.json()),
  topLp: (limit = 100) =>
    fetch(`${API_BASE}/top-lp?limit=${limit}`).then(r => r.json()),
  tvlHistory: () => fetch(`${API_BASE}/charts/tvl`).then(r => r.json()),
  holdersHistory: () => fetch(`${API_BASE}/charts/holders`).then(r => r.json()),
  lpHoldersHistory: () => fetch(`${API_BASE}/charts/lp-holders`).then(r => r.json())
};
