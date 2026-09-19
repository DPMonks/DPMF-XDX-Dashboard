import fs from "node:fs";
import { diskPathForStored } from "./upload.js";

const BOT =
  /facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|Pinterest|Iframely|SkypeUriPreview|vkShare|redditbot|Applebot|Googlebot/i;

export function isSocialCrawler(ua = "") {
  return BOT.test(ua);
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function publicOrigin(req) {
  const env = process.env.PUBLIC_ORIGIN;
  if (env) return env.replace(/\/$/, "");
  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

export function profileImageSrc(profile) {
  const raw = profile?.pImage || profile?.pBanner || profile?.dBanner || "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return raw;
}

export function readStoredImage(stored) {
  const full = diskPathForStored(stored);
  if (!full || !fs.existsSync(full)) return null;
  const ext = full.split(".").pop()?.toLowerCase();
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml"
  };
  return { buffer: fs.readFileSync(full), type: types[ext] || "image/png" };
}

export function fallbackCardSvg(profile) {
  const name = escapeHtml(profile?.pName || "FUZION-XIO profile");
  const line = escapeHtml(profile?.tagline || profile?.bio || profile?.wAddress || "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#050507"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="#0b0c10" stroke="#c770ff" stroke-width="2"/>
  <circle cx="220" cy="315" r="110" fill="#101018" stroke="#00eaff" stroke-width="4"/>
  <text x="220" y="330" text-anchor="middle" fill="#e8e8f5" font-size="64" font-family="sans-serif">${escapeHtml(
    (profile?.pName || "FX").slice(0, 2).toUpperCase()
  )}</text>
  <text x="380" y="280" fill="#c770ff" font-size="48" font-family="sans-serif">${name}</text>
  <text x="380" y="350" fill="#9a9ab3" font-size="28" font-family="sans-serif">${line.slice(0, 72)}</text>
  <text x="380" y="420" fill="#00eaff" font-size="22" font-family="sans-serif">FUZION-XIO · XRPL profile</text>
</svg>`;
}

export function shareHtml({ origin, address, profile, refresh }) {
  const name = escapeHtml(profile?.pName || "FUZION-XIO profile");
  const desc = escapeHtml(
    profile?.tagline ||
      profile?.bio ||
      `Personal profile on FUZION-XIO for ${address}`
  );
  const image = `${origin}/api/og/profile/${encodeURIComponent(address)}`;
  const page = `${origin}/Profile/${encodeURIComponent(address)}`;
  const refreshTag = refresh
    ? `<meta http-equiv="refresh" content="0;url=${page}">`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${name} · FUZION-XIO</title>
    <meta name="description" content="${desc}">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="FUZION-XIO">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${desc}">
    <meta property="og:url" content="${page}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
    ${refreshTag}
  </head>
  <body style="background:#050507;color:#e8e8f5;font-family:sans-serif;padding:48px">
    <p>${name}</p>
    <p><a href="${page}" style="color:#00eaff">Open profile</a></p>
  </body>
</html>`;
}
