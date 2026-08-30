import test from "node:test";
import assert from "node:assert/strict";
import {
  canSelect,
  hasColumn,
  hasTable,
  peekIndexerSchema,
  pickColumns,
  resetIndexerSchemaCache,
  schemaFromRows,
} from "../server/indexerSchema.js";

test("schemaFromRows maps public tables and columns", () => {
  const schema = schemaFromRows([
    { table_name: "xdx_amm_pools", column_name: "amm_account" },
    { table_name: "xdx_amm_pools", column_name: "reserve_xdx" },
    { table_name: "price_latest", column_name: "asset" },
    { table_name: "price_latest", column_name: "price_usd" },
  ]);
  assert.equal(hasTable(schema, "xdx_amm_pools"), true);
  assert.equal(hasTable(schema, "trades"), false);
  assert.equal(hasColumn(schema, "xdx_amm_pools", "reserve_quote"), false);
  assert.equal(hasColumn(schema, "xdx_amm_pools", "reserve_xdx"), true);
  assert.deepEqual(pickColumns(schema, "xdx_amm_pools", ["reserve_quote", "reserve_xdx"]), [
    "reserve_xdx",
  ]);
});

test("unknown schema stays permissive so a failed probe does not skip live tables", () => {
  assert.equal(hasTable(null, "trades"), true);
  assert.equal(hasColumn(null, "xdx_amm_pools", "lp_supply"), true);
  assert.equal(canSelect(null, "order_book_history", ["payload"]), true);
});

test("known schema skips the missing indexer tables and columns from Postgres logs", () => {
  const schema = schemaFromRows([
    { table_name: "xdx_amm_pools", column_name: "amm_account" },
    { table_name: "xdx_amm_pools", column_name: "reserve_xdx" },
    { table_name: "order_book_latest", column_name: "payload" },
    { table_name: "price_latest_all", column_name: "asset" },
    { table_name: "price_latest_all", column_name: "price_usd" },
  ]);
  assert.equal(canSelect(schema, "trades", ["timestamp"]), false);
  assert.equal(canSelect(schema, "order_book_history", ["payload"]), false);
  assert.equal(canSelect(schema, "xrp_balances_latest", ["balance"]), false);
  assert.equal(canSelect(schema, "xdx_amm_pools", ["reserve_quote"]), false);
  assert.equal(canSelect(schema, "xdx_amm_pools", ["lp_supply"]), false);
  assert.equal(canSelect(schema, "price_latest_all", ["currency", "price_usd"]), false);
  assert.equal(canSelect(schema, "price_latest_all", ["asset", "price_usd"]), true);
  assert.equal(pickColumns(schema, "price_latest_all", ["currency", "asset"])[0], "asset");
});

test("schema cache peek is empty until a successful load", () => {
  resetIndexerSchemaCache();
  assert.equal(peekIndexerSchema(), null);
});
