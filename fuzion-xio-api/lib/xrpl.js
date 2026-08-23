import { XRPL_RPC } from "./constants.js";

async function rpc(method, params = [{}]) {
  const res = await fetch(XRPL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params })
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  const body = await res.json();
  if (body.result?.status === "error") {
    return { ok: false, error: body.result.error_message || body.result.error };
  }
  return { ok: true, result: body.result };
}

export async function accountNfts(account, marker) {
  const params = { account, limit: 200 };
  if (marker) params.marker = marker;
  return rpc("account_nfts", [params]);
}

export async function nftInfo(nftId) {
  return rpc("nft_info", [{ nft_id: nftId }]);
}

export async function accountLines(account) {
  return rpc("account_lines", [{ account, limit: 400 }]);
}

export async function serverInfo() {
  return rpc("server_info");
}
