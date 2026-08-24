import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogFetchBlocked,
  isLiveLedgerPath,
  isPostgresOutageStatus,
  markCatalogDown,
  publicApiErrorMessage,
  resetCatalogDown,
} from "../src/api/publicError.js";
import { postgresOutageBody } from "../server/readIndexerDb.js";

test("browser errors do not mention the Railway Postgres host or password", () => {
  const leaked = publicApiErrorMessage(
    {
      error: "timeout exceeded when trying to connect",
      hint: "Postgres connect failed. Check host acela.proxy.rlwy.net:48994, user postgres, database railway, and the current password. Password is not logged.",
    },
    500
  );
  assert.equal(leaked, "Market data is temporarily unavailable.");
  assert.equal(leaked.includes("acela.proxy.rlwy.net"), false);
  assert.equal(leaked.includes("password"), false);
  assert.equal(publicApiErrorMessage({ error: "Postgres temporarily unreachable" }, 503), "Market data is temporarily unavailable.");
});

test("live wallet and xaman paths keep fetching while catalog is in a 503 cooldown", () => {
  resetCatalogDown();
  const now = 1_000_000;
  markCatalogDown(now);
  assert.equal(catalogFetchBlocked("/api/overview", now + 100), true);
  assert.equal(catalogFetchBlocked("/api/charts/activity", now + 100), true);
  assert.equal(catalogFetchBlocked("/api/balances/rABC", now + 100), true);
  assert.equal(isLiveLedgerPath("/api/wallet/account/rABC"), true);
  assert.equal(catalogFetchBlocked("/api/wallet/account/rABC", now + 100), false);
  assert.equal(catalogFetchBlocked("/api/lp-pools/live?pair=XDX/XRP", now + 100), false);
  assert.equal(catalogFetchBlocked("/api/overview", now + 9_000), false);
  resetCatalogDown();
});

test("connect outages are treated as 503s and the JSON body stays public", () => {
  assert.equal(isPostgresOutageStatus(503), true);
  assert.equal(isPostgresOutageStatus(500, "timeout exceeded when trying to connect"), true);
  const body = postgresOutageBody();
  assert.equal(body.error, "Postgres temporarily unreachable");
  assert.equal(body.hint, undefined);
  assert.equal(JSON.stringify(body).includes("acela"), false);
});
