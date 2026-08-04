export default async function tokenDetailsStatic(req, res) {
  try {
    const API = "https://dpmf-xdx-indexer-production.up.railway.app/api/token-details";
    const response = await fetch(API);
    const json = await response.json();
    return json;
  } catch (err) {
    console.error("[DASHBOARD][STATIC FETCH ERROR]", err);
    return { error: "Failed to fetch static token details" };
  }
}
