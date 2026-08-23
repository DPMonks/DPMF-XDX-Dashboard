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

export function vScoreBadge(vScore) {
  const n = Number(vScore) || 0;
  if (n >= 10000) return "gold";
  if (n >= 100) return "blue";
  return "tick";
}
