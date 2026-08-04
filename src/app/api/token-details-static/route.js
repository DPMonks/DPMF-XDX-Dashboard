import tokenDetailsStatic from "../../../api/token-details-static.js";

export async function GET() {
  try {
    const data = await tokenDetailsStatic({}, { json: (d) => d });
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error("[DASHBOARD][STATIC ERROR]", err);
    return new Response(JSON.stringify({ error: "Failed to load static data" }), { status: 500 });
  }
}
