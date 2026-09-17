/** Main-page live-data freeze while AIM is open on mobile. */

let aimPageFrozen = false;

export function isAimPageFrozen() {
  return aimPageFrozen;
}

/**
 * Freeze or thaw main-page live updates.
 * Toggles body.aim-page-frozen, sets the module flag, and dispatches
 * window event "dpmf-aim-page-freeze" with { detail: { frozen } }.
 * On thaw (frozen false), also dispatches "dpmf-aim-page-thaw".
 */
export function setAimPageFrozen(frozen) {
  const next = Boolean(frozen);
  const prev = aimPageFrozen;
  aimPageFrozen = next;
  if (typeof document !== "undefined") {
    document.body.classList.toggle("aim-page-frozen", next);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dpmf-aim-page-freeze", { detail: { frozen: next } })
    );
    if (prev && !next) {
      window.dispatchEvent(
        new CustomEvent("dpmf-aim-page-thaw", { detail: { frozen: false } })
      );
    }
  }
}
