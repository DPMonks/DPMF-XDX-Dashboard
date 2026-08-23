export function xioRank(balance) {
  const x = Number(balance) || 0;
  if (x > 0 && x <= 0.000999999999999) return "New Validator";
  if (x >= 0.001 && x <= 0.00999999999999) return "Beginner Validator";
  if (x >= 0.01 && x <= 0.099999999999999) return "Basic Validator";
  if (x >= 0.1 && x <= 0.99999999999999) return "Validator";
  if (x >= 1 && x <= 9.999999999999999) return "Active Validator";
  if (x >= 10 && x <= 99.999999999999999) return "Trusted Validator";
  if (x >= 100) return "Master Validator";
  return "Unranked";
}

export function vScoreBadge(vScore) {
  const n = Number(vScore) || 0;
  if (n >= 10000) return "gold";
  if (n >= 100) return "blue";
  return "tick";
}
