export const AIM_COMMAND_TOPICS = [
  { id: "chat", label: "Chat", hint: "General talk. Commander stays autonomous and still learns.", placeholder: "Ask Commander..." },
  { id: "trade", label: "Trade", hint: "Buy or sell XDX. Agents take the book.", placeholder: "buy XDX with XRP..." },
  { id: "analyse", label: "Analyse", hint: "Hunt pairs for a fee-clear profitable trade.", placeholder: "analyse markets for a profitable trade..." },
  { id: "chart", label: "Chart", hint: "Orders, depth, ledger lines on the chart.", placeholder: "show my orders..." },
  { id: "predict", label: "Predict", hint: "Lay tools and estimates on the active pair.", placeholder: "draw a bullish prediction..." },
  { id: "trustline", label: "Trustlines", hint: "Add or check trustlines on agent wallets.", placeholder: "add trustline XSQUAD..." },
  { id: "liquidity", label: "Liquidity", hint: "AMM deposit or withdraw. XDX stays primary.", placeholder: "add liquidity XDX + XRP..." },
  { id: "objective", label: "Objectives", hint: "Standing desk goals. Soft-remove only.", placeholder: "objective grow XIO/XRP arb..." },
  { id: "desk", label: "Desk", hint: "Regime, bias, structure, what we work toward.", placeholder: "what is the desk view..." },
  { id: "venue", label: "Venue", hint: "Exchange and venue overview.", placeholder: "show XDX venue..." },
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
