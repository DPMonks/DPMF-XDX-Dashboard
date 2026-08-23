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

export async function nftBuyOffers(nftId) {
  return rpc("nft_buy_offers", [{ nft_id: nftId, limit: 200 }]);
}

export async function nftSellOffers(nftId) {
  return rpc("nft_sell_offers", [{ nft_id: nftId, limit: 200 }]);
}

export async function accountTx(account, limit = 20) {
  return rpc("account_tx", [{ account, limit, forward: false }]);
}

export async function accountCurrencies(account) {
  return rpc("account_currencies", [{ account, ledger_index: "validated" }]);
}

export async function accountInfo(account) {
  return rpc("account_info", [{ account, ledger_index: "validated" }]);
}

export async function gatewayBalances(account) {
  return rpc("gateway_balances", [{ account, ledger_index: "validated", strict: true }]);
}

export async function bookOffers(takerGets, takerPays, limit = 5) {
  return rpc("book_offers", [{ taker_gets: takerGets, taker_pays: takerPays, limit }]);
}
