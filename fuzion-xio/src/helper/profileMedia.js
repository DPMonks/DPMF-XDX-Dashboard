import configData from "../config.json";
import { replaceHost } from "./index.js";

export function profileMediaUrl(path, fallback = "") {
  if (!path) return fallback;
  if (
    path.startsWith("data:") ||
    path.startsWith("blob:") ||
    path.startsWith("/")
  ) {
    return path;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path.startsWith("https://ipfs.io/") ? replaceHost(path) : path;
  }
  return `${configData.LOCAL_API_URL}${String(path).replace(/^\//, "")}`;
}

export function profileShareUrl(address) {
  if (!address) return `${window.location.origin}/profiles`;
  return `${window.location.origin}/share/profile/${address}`;
}

export function setProfileSocialMeta(profile = {}) {
  const title = `${profile.pName || "FUZION-XIO profile"} · FUZION-XIO`;
  const description =
    profile.tagline ||
    profile.bio ||
    "Personal profile on the FUZION-XIO XRPL exchange.";
  const image = `${window.location.origin}/api/og/profile/${encodeURIComponent(
    profile.wAddress || ""
  )}`;
  document.title = title;
  const tags = [
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:image", image],
    ["property", "og:type", "profile"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
    ["name", "description", description]
  ];
  for (const [attr, key, value] of tags) {
    let node = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute(attr, key);
      document.head.appendChild(node);
    }
    node.setAttribute("content", value);
  }
}
