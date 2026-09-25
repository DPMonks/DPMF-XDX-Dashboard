import assert from "node:assert/strict";
import { demoSeed } from "../lib/seed.js";
import {
  deskMints,
  hexToText,
  nftIdFromMeta,
  parseMintTx,
  publicUri,
  rippleTimeToIso
} from "../lib/ledgerMints.js";

assert.equal(
  hexToText("697066733A2F2F62616679"),
  "ipfs://bafy"
);
assert.equal(
  publicUri("ipfs://bafybeiassoiq34/38.json"),
  "https://dweb.link/ipfs/bafybeiassoiq34/38.json"
);
assert.equal(rippleTimeToIso(840818681).startsWith("20"), true);

const nftId = nftIdFromMeta({
  nftoken_id: "000813884F89003F76ABC636177217C70F7FF72E4EDEF18784D837620657E5C8"
});
assert.equal(nftId.startsWith("00081388"), true);

const fromPages = nftIdFromMeta({
  AffectedNodes: [
    {
      ModifiedNode: {
        LedgerEntryType: "NFTokenPage",
        PreviousFields: { NFTokens: [{ NFToken: { NFTokenID: "OLD" } }] },
        FinalFields: {
          NFTokens: [
            { NFToken: { NFTokenID: "OLD" } },
            { NFToken: { NFTokenID: "NEWTOKEN0001" } }
          ]
        }
      }
    }
  ]
});
assert.equal(fromPages, "NEWTOKEN0001");

const mint = parseMintTx(
  {
    TransactionType: "NFTokenMint",
    Account: "rMinter111111111111111111111111111",
    Issuer: "rIssuer111111111111111111111111111",
    URI: "697066733A2F2F62616679",
    hash: "ABCD",
    metaData: {
      TransactionResult: "tesSUCCESS",
      nftoken_id: "0008DEADBEEF"
    }
  },
  106493245,
  840818681
);
assert.equal(mint.source, "xrpl");
assert.equal(mint.NFTokenID, "0008DEADBEEF");
assert.equal(mint.badge, "Minted on XRPL");
assert.ok(mint.explorer.includes("0008DEADBEEF"));

assert.equal(parseMintTx({ TransactionType: "Payment" }, 1, 1), null);
assert.equal(
  parseMintTx(
    {
      TransactionType: "NFTokenMint",
      metaData: { TransactionResult: "tecNO_ENTRY" }
    },
    1,
    1
  ),
  null
);

const store = demoSeed();
const desk = deskMints(store);
assert.ok(desk.some((row) => row.name === "FUZION 3D #1"));
assert.ok(desk.every((row) => row.badge));

console.log(`ledger mints parse ok: desk=${desk.length} xrpl=${mint.NFTokenID}`);
