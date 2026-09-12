import configData from "../config.json";

// src/utils/logger.js
const logToServer = async (level, message) => {
  try {
    await fetch(`${configData.LOCAL_API_URL}logs`, {
      // update with your server URL
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    });
  } catch (err) {
    // console.error("Failed to send log to server:", err);
  }
};

const overrideConsole = () => {
  ["log", "error"].forEach((level) => {
    const original = console[level];
    console[level] = (...args) => {
      original(...args); // normal console behavior
      logToServer(
        level,
        args
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
          .join(" ")
      );
    };
  });
};

export default overrideConsole;
