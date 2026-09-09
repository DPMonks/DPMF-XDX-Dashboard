export const AIM_LANG_PREF_KEY = "aim.commander.lang";

/** Supported Commander reply/voice languages. */
export const AIM_LANGUAGES = [
  { code: "auto", label: "Auto (IP)" },
  { code: "en", label: "English" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "tr", label: "Türkçe" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

const COUNTRY_LANG = {
  GB: "en-GB", IE: "en-GB", AU: "en", NZ: "en", US: "en", CA: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  BR: "pt", PT: "pt",
  FR: "fr", BE: "fr", CH: "de",
  DE: "de", AT: "de",
  IT: "it", NL: "nl", PL: "pl", RU: "ru",
  SA: "ar", AE: "ar", EG: "ar", MA: "ar",
  TR: "tr", IN: "hi", CN: "zh", TW: "zh", HK: "zh", SG: "en",
  JP: "ja", KR: "ko",
};

export function countryToLang(country) {
  const cc = String(country || "").toUpperCase();
  return COUNTRY_LANG[cc] || "en";
}

export function normalizeLang(code) {
  const raw = String(code || "en").trim();
  if (!raw || raw === "auto") return "en";
  const hit = AIM_LANGUAGES.find((l) => l.code.toLowerCase() === raw.toLowerCase());
  if (hit && hit.code !== "auto") return hit.code;
  const base = raw.split("-")[0].toLowerCase();
  const baseHit = AIM_LANGUAGES.find((l) => l.code.toLowerCase() === base);
  return baseHit?.code || "en";
}

export function readLangPref() {
  try {
    return localStorage.getItem(AIM_LANG_PREF_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function writeLangPref(code) {
  try {
    localStorage.setItem(AIM_LANG_PREF_KEY, code || "auto");
  } catch {
    /* ignore */
  }
}

export async function fetchSuggestedLocale() {
  const res = await fetch("/api/aim/locale", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "locale failed");
  return data;
}
