import tokenDetailsLive from "../../../api/token-details-live.js";

export async function GET() {
  try {
    const data = await tokenDetailsLive({}, { json: (d) => d });
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error("[DASHBOARD][LIVE ERROR]", err);
    return new Response(JSON.stringify({ error: "Failed to load live data" }), { status: 500 });
  }
}
