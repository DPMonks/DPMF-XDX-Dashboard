# Indexer ask: today's XDX owner snapshot

Dashboard PR: https://github.com/DPMonks/DPMF-XDX-Dashboard/pull/4  
Dashboard is **SELECT-only**. Do **not** start or reset workers from the dashboard. Holder worker stagger stays **35s**.

The rich list is **today's current XDX owners**, not mixed historical rows.

## What the dashboard now calls

```
GET /api/top-holders?limit=100&offset=0&snapshot=today
GET /api/top-holders-v2?limit=100&offset=0&snapshot=today
GET /api/holders/count?snapshot=today
```

`snapshot=today` means the **UTC calendar day** of the latest holder scan.

## Required response

Object (array-only is still accepted, but the dashboard needs the stamp):

```json
{
  "holders": [
    { "rank": 1, "account": "r...", "balance": 421351742.9329, "frozen": false }
  ],
  "as_of": "2026-08-21T20:15:00.000Z",
  "snapshot_day": "2026-08-21",
  "present": true,
  "catching_up": false,
  "count": 235,
  "source": "token_holders_latest"
}
```

Field is **`balance`**, wallets with **balance > 0 only** (0-balance trustlines are not owners).

If there is **no scan dated today UTC**:

```json
{
  "holders": [],
  "as_of": "<last scan if any>",
  "snapshot_day": "<last scan day>",
  "present": false,
  "catching_up": true,
  "count": 0
}
```

Do **not** fall back to `DISTINCT ON (account)` across old days. That mixes last week's balances into "current owners".

## Indexer write path

1. Each holder cycle overwrites **`token_holders_latest`** with the full current owner set (one row per account, `balance > 0`).
2. Stamp the **same `timestamp`** (and ledger index if you have it) on every row in that cycle.
3. Also append that same-time set to **`token_holders_history`**.
4. `GET /api/top-holders?snapshot=today` reads that one scan if `timestamp::date = CURRENT_DATE` (UTC).

Catalog can add the same query string; no new path is required.

Auth: none. `accept: application/json`. Do not call `/api/cluster/v1/*`.
