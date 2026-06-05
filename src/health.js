import { logger } from "./utils/logger.js";

let lastCycleTimestamp = Date.now();

export function updateHealthTimestamp() {
  lastCycleTimestamp = Date.now();
}

export function getHealthStatus() {
  const now = Date.now();
  const diff = now - lastCycleTimestamp;

  return {
    status: diff > 60000 ? "unhealthy" : "ok",
    uptime: process.uptime(),
    lastCycle: lastCycleTimestamp,
    timestamp: new Date().toISOString()
  };
}
