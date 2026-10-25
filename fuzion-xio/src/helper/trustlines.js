import configData from "../config.json";

export async function ensureWalletTrustlines(address, assets = []) {
  if (!address) return null;
  const rows = (Array.isArray(assets) ? assets : [assets]).filter(
    (asset) => asset?.currency && asset.currency !== "XRP"
  );
  if (!rows.length) return { skipped: true };
  const res = await fetch(`${configData.LOCAL_API_URL}wallet/trustlines`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, assets: rows })
  });
  return res.json();
}
