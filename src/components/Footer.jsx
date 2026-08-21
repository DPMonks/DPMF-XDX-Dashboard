import { useI18n } from "../i18n/useI18n";

export default function Footer() {
  const { t, country, lang } = useI18n();

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <strong>DPMF</strong>
        <span>{t.footerTagline}</span>
      </div>
      <p className="footer-about">{t.footerAbout}</p>
      <a
        className="footer-link"
        href="https://dpmf.technology"
        target="_blank"
        rel="noreferrer"
      >
        {t.footerSite}
      </a>
      {country && (
        <p className="footer-locale">
          {t.detected}: {country} · {lang.toUpperCase()}
        </p>
      )}
    </footer>
  );
}
