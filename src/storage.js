// ------------------------------------------------------
// IN-MEMORY STORAGE FOR INDEXER DATA
// ------------------------------------------------------

let latestSnapshot = null;
let ammState = null;
let holders = [];
let lpHolders = [];

// Save functions (called by indexer.js)
export function saveLatestSnapshot(data) {
  latestSnapshot = data;
}

export function saveAmmState(data) {
  ammState = data;
}

export function saveHolders(data) {
  holders = data;
}

export function saveLpHolders(data) {
  lpHolders = data;
}

// Get functions (used by server.js)
export function getLatestSnapshot() {
  return latestSnapshot;
}

export function getAmmState() {
  return ammState;
}

export function getHolders() {
  return holders;
}

export function getLpHolders() {
  return lpHolders;
}
