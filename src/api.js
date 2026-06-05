const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api";

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
