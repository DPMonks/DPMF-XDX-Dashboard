
export async function fetchAccountLines(account) {
  const body = {
    method: "account_lines",
    params: [
      {
        account,
        ledger_index: "validated"
      }
    ]
  };

  const result = await rpc(body);

  // SAFETY: RPC returned nothing or malformed data
  if (!result || !result.lines || !Array.isArray(result.lines)) {
    return [];
  }

  return result.lines;
}

console.log("[XRPL] SAFE fetchAccountLines loaded");

}

console.log("[XRPL] SAFE fetchAccountLines loaded");
