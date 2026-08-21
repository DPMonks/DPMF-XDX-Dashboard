import { useEffect, useMemo, useState } from "react";
import { I18nContext } from "./i18nContextInstance";
import {
  languageFromCountry,
  normalizeLang,
  RTL_LANGS,
} from "./countries";
import { getMessages, SUPPORTED_LANGS } from "./messages";

function browserLang() {
  if (typeof navigator === "undefined") return "en";
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of tags) {
    const lang = normalizeLang(tag);
    if (SUPPORTED_LANGS.includes(lang)) return lang;
  }
  return normalizeLang(tags[0]);
}

function firstSupportedLanguage(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(",")
    .map((part) => normalizeLang(part.trim()))
    .filter(Boolean);
  return parts.find((lang) => SUPPORTED_LANGS.includes(lang)) || parts[0] || null;
}

async function detectFromIp() {
  const sources = [
    async () => {
      const res = await fetch("https://ipwho.is/");
      const data = await res.json();
      if (!data?.success) return null;
      return {
        country: data.country,
        countryCode: data.country_code,
        languages: data.languages,
      };
    },
    async () => {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data?.error) return null;
      return {
        country: data.country_name,
        countryCode: data.country_code || data.country,
        languages: data.languages,
      };
    },
  ];

  for (const source of sources) {
    try {
      const geo = await source();
      if (geo?.countryCode) return geo;
    } catch {
      // try next provider
    }
  }
  return null;
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => browserLang());
  const [country, setCountry] = useState(null);
  const [locale, setLocale] = useState(
    () => (typeof navigator !== "undefined" && navigator.language) || "en"
  );

  useEffect(() => {
    let cancelled = false;

    detectFromIp().then((geo) => {
      if (cancelled || !geo) return;
      const fromIpLanguages = firstSupportedLanguage(geo.languages);
      const fromCountry = languageFromCountry(geo.countryCode);
      const nextLang = fromIpLanguages || fromCountry || browserLang();
      setLang(nextLang);
      setCountry(geo.country || geo.countryCode);
      setLocale(
        geo.countryCode
          ? `${normalizeLang(nextLang)}-${String(geo.countryCode).toUpperCase()}`
          : nextLang
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo(() => {
    const t = getMessages(lang);
    return {
      t,
      lang,
      locale,
      country,
      dir: RTL_LANGS.has(lang) ? "rtl" : "ltr",
    };
  }, [lang, locale, country]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
