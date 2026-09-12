const KEY = "fuzion-view";

export function getViewMode() {
  return localStorage.getItem(KEY) === "pro" ? "pro" : "standard";
}

export function setViewMode(mode) {
  localStorage.setItem(KEY, mode === "pro" ? "pro" : "standard");
  window.dispatchEvent(new Event("fuzion-view"));
}
