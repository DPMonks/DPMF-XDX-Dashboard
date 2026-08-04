export default async function tokenDetailsLive(req, res) {
  try {
    const API = "https://dpmf-xdx-indexer-production.up.railway.app/api/token-details";
    const response = await fetch(API);
    const json = await response.json();
    return json;
  } catch (err) {
    console.error("[DASHBOARD][LIVE FETCH ERROR]", err);
    return { error: "Failed to fetch live token details" };
  }
}
