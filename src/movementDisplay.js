/**
 * Display-only labels for AIM recent movement.
 * Stored kind keys stay unchanged (trade_proposal remains trade_proposal).
 * Pairs are shown only when a payload already has one.
 */

const PAIR_RE = /^[A-Za-z0-9.]{2,20}\/[A-Za-z0-9.]{2,20}$/;
const TRADE_KINDS = new Set(["trade_proposal", "trade_execution", "trade_blocked"]);

function stripUiDashes(text) {
  return String(text || "")
    .replace(/\u2014/g, ". ")
    .replace(/\u2013/g, "-")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function child(obj, key) {
  const value = obj?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function usableToken(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(n\/a|na|none|null|undefined|-)$/i.test(text)) return "";
  return text;
}

export function cleanPair(value) {
  const compact = String(value ?? "").trim().replace(/\s+/g, "");
  if (!PAIR_RE.test(compact)) return "";
  if (/secret|seed|mnemonic|password|private/i.test(compact)) return "";
  return compact.toUpperCase();
}

function firstPair(values) {
  for (const value of values) {
    const pair = cleanPair(value);
    if (pair) return pair;
  }
  return "";
}

export function humanizeLabel(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function humanizeDisplayText(value) {
  return stripUiDashes(String(value ?? "").replace(/_/g, " "));
}

function clip(value, max = 72) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function humanizeTail(value) {
  const text = usableToken(value);
  if (!text) return "";
  const flat = text.replace(/[\s_]+/g, "");
  if (/^tes/i.test(flat)) return flat;
  return clip(text.replace(/_/g, " ").replace(/\s+/g, " ").trim());
}

export function readMovementPair(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const proposal = child(content, "proposal");
  const trade = child(content, "trade_proposal");
  const exec = child(content, "exec");
  const last = child(content, "last_fill");
  const fill = child(content, "fill");
  return firstPair([
    content.pair,
    proposal.pair,
    trade.pair,
    exec.pair,
    last.pair,
    fill.pair,
    child(proposal, "exec").pair,
    child(trade, "exec").pair,
    content.market,
    content.symbol,
    proposal.market,
    trade.market,
  ]);
}

function readUrgency(obj) {
  const proposal = child(obj, "proposal");
  const trade = child(obj, "trade_proposal");
  return usableToken(obj.urgency || proposal.urgency || trade.urgency || "");
}

function readOutcome(obj) {
  const proposal = child(obj, "proposal");
  const trade = child(obj, "trade_proposal");
  const exec = child(obj, "exec");
  const last = child(obj, "last_fill");
  const fill = child(obj, "fill");
  const propExec = child(proposal, "exec");
  const tradeExec = child(trade, "exec");
  return usableToken(
    obj.engine_result ||
      exec.engine_result ||
      last.engine_result ||
      fill.engine_result ||
      propExec.engine_result ||
      tradeExec.engine_result ||
      obj.result ||
      obj.outcome ||
      obj.transaction_result ||
      obj.TransactionResult ||
      ""
  );
}

function readBlocked(obj) {
  const proposal = child(obj, "proposal");
  const trade = child(obj, "trade_proposal");
  const exec = child(obj, "exec");
  const last = child(obj, "last_fill");
  const fill = child(obj, "fill");
  const propExec = child(proposal, "exec");
  const tradeExec = child(trade, "exec");
  const display = usableToken(
    obj.blocked_by_display ||
      exec.blocked_by_display ||
      last.blocked_by_display ||
      fill.blocked_by_display ||
      proposal.blocked_by_display ||
      trade.blocked_by_display ||
      propExec.blocked_by_display ||
      tradeExec.blocked_by_display ||
      ""
  );
  const code = usableToken(
    obj.blocked_by ||
      exec.blocked_by ||
      last.blocked_by ||
      fill.blocked_by ||
      proposal.blocked_by ||
      trade.blocked_by ||
      propExec.blocked_by ||
      tradeExec.blocked_by ||
      ""
  );
  return display || code;
}

function includesPair(text, pair) {
  if (!pair) return true;
  return String(text || "").toUpperCase().includes(pair.toUpperCase());
}

function withPair(line, pair) {
  if (!pair || includesPair(line, pair)) return line;
  return `${line} | ${pair}`;
}

function joinParts(...parts) {
  const out = [];
  for (const part of parts) {
    const text = String(part || "").trim();
    if (!text) continue;
    if (out.some((prev) => prev.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
  }
  return out.join(" | ") || "update";
}

function blockTail(reason, labelAlreadyBlocked) {
  const nice = humanizeTail(reason);
  if (labelAlreadyBlocked) {
    if (!nice || /^(blocked|block|trade blocked)$/i.test(nice)) return "";
    return nice;
  }
  if (!nice) return "blocked";
  if (/\bblock(?:ed)?\b/i.test(nice)) return nice;
  return `blocked, ${nice}`;
}

function tradeLine(kind, obj) {
  const label = humanizeLabel(kind);
  const pair = readMovementPair(obj);
  const blocked = readBlocked(obj);
  const outcome = readOutcome(obj);
  const urgency = readUrgency(obj);
  const labelAlreadyBlocked = kind === "trade_blocked";
  const tail = labelAlreadyBlocked || blocked
    ? blockTail(blocked, labelAlreadyBlocked)
    : humanizeTail(outcome || urgency);
  return joinParts(label, pair, tail);
}

function legacyLine(kind, content) {
  if (kind === "pools" || content.pools) {
    const pools = content.pools && typeof content.pools === "object" ? content.pools : content;
    if (pools.ok) return `Pool scan ok · ${pools.pool_count ?? "?"} pools · top ${pools.top_pool || "n/a"}`;
    return `Pool scan issue · ${pools.error || "unknown"}`;
  }
  if (content.indexer?.skipped) return "Observing via private data path";
  if (content.indexer?.status_code) return `Indexer probe · HTTP ${content.indexer.status_code}`;
  if (content.last_indexer?.status_code) return `Indexer probe · HTTP ${content.last_indexer.status_code}`;
  if (content.public?.results) return "Public market ping";
  if (content.type === "scan_directive") return "Observe-only directive";
  if (content.type === "ping") return "Peer ping";
  return "";
}

export function isTradeMovementKind(kind) {
  return TRADE_KINDS.has(String(kind || ""));
}

export function formatMovementSummary(kind, content) {
  const safeKind = String(kind || "update").trim() || "update";
  const obj = content && typeof content === "object" && !Array.isArray(content) ? content : null;
  if (isTradeMovementKind(safeKind)) return stripUiDashes(tradeLine(safeKind, obj || {}));
  if (obj) {
    const legacy = legacyLine(safeKind, obj);
    if (legacy) return stripUiDashes(withPair(legacy, readMovementPair(obj)));
  }
  const pair = obj ? readMovementPair(obj) : "";
  const blocked = obj ? readBlocked(obj) : "";
  const outcome = obj ? readOutcome(obj) : "";
  const urgency = obj ? readUrgency(obj) : "";
  const tail = blocked ? blockTail(blocked, false) : humanizeTail(outcome || urgency);
  return stripUiDashes(joinParts(humanizeLabel(safeKind), pair, tail));
}

export function movementTone({ kind = "", text = "" } = {}) {
  const kindNorm = String(kind || "").toLowerCase().replace(/_/g, " ");
  const blob = `${kindNorm} ${String(text || "").toLowerCase()}`;
  if (
    kindNorm === "trade blocked" ||
    /\btrade blocked\b/.test(blob) ||
    /\bblocked\b/.test(blob) ||
    /\bblock\b/.test(blob)
  ) {
    return "block";
  }
  const flat = blob.replace(/[\s_]+/g, "");
  if (flat.includes("tessuccess") || /\bsuccess(?:ful)?\b/.test(blob)) return "success";
  return "";
}

function contentFromMove(move, pair) {
  const base = move?.content && typeof move.content === "object" && !Array.isArray(move.content) ? move.content : {};
  return {
    ...base,
    ...(pair ? { pair } : {}),
    ...(move?.urgency ? { urgency: move.urgency } : {}),
    ...(move?.engine_result ? { engine_result: move.engine_result } : {}),
    ...(move?.blocked_by ? { blocked_by: move.blocked_by } : {}),
    ...(move?.blocked_by_display ? { blocked_by_display: move.blocked_by_display } : {}),
    ...(move?.outcome ? { outcome: move.outcome } : {}),
  };
}

function insertPair(text, pair) {
  const parts = String(text || "")
    .split(" | ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return pair;
  parts.splice(1, 0, pair);
  return parts.join(" | ");
}

export function presentMovement(move = {}) {
  const kind = String(move.kind || "").trim();
  const explicitPair = cleanPair(move.pair) || readMovementPair(move);
  const rawSummary = String(move.summary || "").trim();
  const summaryIsRaw = !rawSummary || rawSummary === kind;
  let text = summaryIsRaw
    ? formatMovementSummary(kind || "update", contentFromMove(move, explicitPair))
    : humanizeDisplayText(rawSummary);
  if (!summaryIsRaw && explicitPair && !includesPair(text, explicitPair)) text = insertPair(text, explicitPair);
  text = stripUiDashes(text);
  return { text: text || "update", tone: movementTone({ kind, text }) };
}
