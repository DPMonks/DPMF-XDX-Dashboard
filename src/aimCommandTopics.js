export const AIM_COMMAND_TOPICS = [
  { id: "chat", label: "Chat", hint: "Talk normally. He works out intent and still learns.", placeholder: "Ask Commander..." },
  { id: "trade", label: "Trade", hint: "Say it loosely. He maps buy or sell for the desk.", placeholder: "get me some XDX with RLUSD..." },
  { id: "analyse", label: "Analyse", hint: "Ask him to hunt. Exact wording is not required.", placeholder: "find something that clears fees..." },
  { id: "chart", label: "Chart", hint: "Orders, depth, ledger lines. He maps the ask.", placeholder: "put my orders on the chart..." },
  { id: "predict", label: "Predict", hint: "Ask for a view. He lays tools on the active pair.", placeholder: "give me a bearish view..." },
  { id: "trustline", label: "Trustlines", hint: "Name the asset. He adds or checks the line.", placeholder: "we still need XSQUAD..." },
  { id: "liquidity", label: "Liquidity", hint: "Top up or pull a pool. XDX stays primary.", placeholder: "top up the XDX/XRP pool..." },
  { id: "objective", label: "Objectives", hint: "Standing desk goals. Soft-remove only.", placeholder: "keep growing XIO/XRP arb..." },
  { id: "desk", label: "Desk", hint: "Regime, live phases, what we work toward.", placeholder: "unlock the desk and go live..." },
  { id: "venue", label: "Venue", hint: "Exchange and venue overview.", placeholder: "walk the XDX venue..." },
];

const TOPIC_IDS = new Set(AIM_COMMAND_TOPICS.map((row) => row.id));

export function normalizeCommandTopic(raw) {
  const id = String(raw || "chat")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (id === "prediction" || id === "predictions") return "predict";
  if (id === "trust" || id === "trustlines") return "trustline";
  if (id === "liq" || id === "amm" || id === "pool") return "liquidity";
  if (id === "objectives" || id === "goal") return "objective";
  if (id === "analyze" || id === "analysis" || id === "hunt" || id === "scan") return "analyse";
  if (id === "orders" || id === "orderbook") return "chart";
  if (TOPIC_IDS.has(id)) return id;
  return "chat";
}

export function commandTopicMeta(raw) {
  const id = normalizeCommandTopic(raw);
  return AIM_COMMAND_TOPICS.find((row) => row.id === id) || AIM_COMMAND_TOPICS[0];
}
