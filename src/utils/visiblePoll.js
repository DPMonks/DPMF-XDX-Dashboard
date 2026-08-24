export function isDocumentHidden(doc = typeof document !== "undefined" ? document : null) {
  return Boolean(doc && doc.visibilityState === "hidden");
}

export function startVisiblePoll(
  load,
  intervalMs,
  {
    documentObject = typeof document !== "undefined" ? document : null,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}
) {
  if (typeof load !== "function") return () => {};
  const tick = () => {
    if (isDocumentHidden(documentObject)) return undefined;
    return load();
  };
  const id = setIntervalFn(tick, Number(intervalMs) || 30_000);
  function onVisibility() {
    if (!isDocumentHidden(documentObject)) load();
  }
  documentObject?.addEventListener?.("visibilitychange", onVisibility);
  return () => {
    clearIntervalFn(id);
    documentObject?.removeEventListener?.("visibilitychange", onVisibility);
  };
}
