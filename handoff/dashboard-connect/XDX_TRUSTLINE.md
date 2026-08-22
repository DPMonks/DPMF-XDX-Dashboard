# XDX Trustline (dashboard → Xaman → indexer)

Dashboard branch: `cursor/xdx-trustline-99bb`  
Script to build off: `scripts/xdx-trustline-handoff.js`

```
node scripts/xdx-trustline-handoff.js
```

The dashboard **XDX Trustline** button uses the same DPMF Xaman path as Connect Wallet (`POST /api/xaman/create-payload`). It asks the user to sign a **TrustSet** (`submit: true`) so XRPL adds the XDX line.

## Ledger constants

| Field | Value |
|---|---|
| Issuer | `rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo` |
| Currency | `XDX` |
| Hex | `5844580000000000000000000000000000000000` |
| Limit | `10000000000` (total supply) |
| Flags | `131072` (`tfSetNoRipple`) |

## Xaman payload

```json
{
  "txjson": {
    "TransactionType": "TrustSet",
    "Flags": 131072,
    "LimitAmount": {
      "currency": "XDX",
      "issuer": "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",
      "value": "10000000000"
    }
  },
  "options": {
    "submit": true
  }
}
```

If a wallet is already connected, `txjson.Account` is set to that address so Xaman pre-selects it.

## Indexer

Do **not** start workers. Do **not** invent `/api/cluster/v1/*`.

After the sign, the line is a normal `RippleState` on the issuer. The existing XRPL Node 3 token holder / trustline scan should include it on the next snapshot.

Reads already used by the dashboard:

- `GET /api/trustlines/count`
- `GET /api/charts/trustlines`
- `GET /api/holders/count`

Trustlines ≠ holders. Count every line, including `balance = 0`.

If you need a faster path than the next Node 3 scan, watch `account_tx` / the ledger stream for `TrustSet` + `RippleState` matching the issuer and increment `trustline_count`. SQL hint is in the script output.
