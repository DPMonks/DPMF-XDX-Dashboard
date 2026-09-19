export function xioRank(balance) {
  const x = Number(balance) || 0;
  if (x >= 100) return "Master Validator";
  if (x >= 10) return "Trusted Validator";
  if (x >= 1) return "Active Validator";
  if (x >= 0.1) return "Validator";
  if (x >= 0.01) return "Basic Validator";
  if (x >= 0.001) return "Beginner Validator";
  if (x >= 0.0001) return "New Validator";
  return "Unranked";
}

export const V_SCORE_BLUE = 100;
export const V_SCORE_GOLD = 10000;

export function vScoreBadge(vScore) {
  const n = Number(vScore) || 0;
  if (n >= V_SCORE_GOLD) return "gold";
  if (n >= V_SCORE_BLUE) return "blue";
  return "tick";
}
