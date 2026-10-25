import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  disseminateUploads,
  disseminateZip,
  extractZip,
  markCreated,
  parseManifest
} from "../lib/prepared.js";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fuzion-prepared-"));

const manifest = parseManifest(JSON.stringify({
  name: "Desk Pack",
  collectionName: "Desk Pack",
  items: [
    { file: "hero.png", name: "Hero #1", description: "Lead" },
    { file: "tone.png", name: "Tone #2" }
  ]
}));
assert.equal(manifest.collectionName, "Desk Pack");
assert.equal(manifest.items[0].name, "Hero #1");

const zip = new JSZip();
zip.file("hero.png", PNG);
zip.file("tone.png", PNG);
zip.file("manifest.json", JSON.stringify({
  name: "Desk Pack",
  collectionName: "Desk Pack",
  items: [
    { file: "hero.png", name: "Hero #1" },
    { file: "tone.png", name: "Tone #2" }
  ]
}));
zip.file("__MACOSX/._hero.png", Buffer.from("skip"));
const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
const extracted = await extractZip(zipBuf);
assert.ok(!extracted.some((row) => row.name.startsWith("._")));
assert.ok(extracted.some((row) => row.name === "hero.png"));

const pack = await disseminateZip(
  dir,
  { originalname: "desk-pack.zip", buffer: zipBuf },
  [],
  { account: "rTestPrepared1111111111111111111" }
);
assert.equal(pack.items.length, 2);
assert.equal(pack.items[0].status, "ready");
assert.equal(pack.items.find((item) => item.originalName === "hero.png")?.name, "Hero #1");
assert.ok(pack.items.every((item) => item.url.startsWith("/api/uploads/")));
assert.ok(pack.items.every((item) => fs.existsSync(path.join(dir, item.url.split("/").pop()))));

const loose = disseminateUploads(
  dir,
  [
    { originalname: "solo.png", mimetype: "image/png", buffer: PNG }
  ],
  { packName: "Loose", account: "rTest" }
);
assert.equal(loose.items.length, 1);
assert.equal(loose.status, "ready");

markCreated(pack, [
  { itemId: pack.items[0]._id, url: pack.items[0].url, nftId: "mint-1" }
]);
assert.equal(pack.items[0].status, "created");
assert.equal(pack.status, "partial");

console.log(`prepared packs ok: zip=${pack.items.length} loose=${loose.items.length}`);
