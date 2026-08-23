import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(root, "..", "data", "store.json");

const empty = () => ({
  version: 0,
  nfts: [],
  profiles: [],
  likes: [],
  offers: [],
  mints: [],
  bids: [],
  moreoffers: [],
  sends: [],
  tradehistories: [],
  xumms: [],
  leaderboards: [],
  collections: [],
  collectionTemplates: [],
  xioHolders: [],
  auctions: [],
  activity: [],
  watchlist: [],
  listingOverrides: {},
  knownAssets: [],
  profileNfts: [],
  preparedPacks: [],
  wallets: [],
  fees: []
});

function ensure() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(empty(), null, 2));
  }
}

export function readStore() {
  ensure();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

export function writeStore(next) {
  ensure();
  fs.writeFileSync(dataFile, JSON.stringify(next, null, 2));
  return next;
}

export function resetStore(seed) {
  const next = { ...empty(), ...seed };
  return writeStore(next);
}

export function update(mutator) {
  const current = readStore();
  const next = mutator(current) || current;
  return writeStore(next);
}
