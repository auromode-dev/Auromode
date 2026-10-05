"use client";
import { MotionLink as Link, MotionButton } from "@/components/motion-controls";
import { PageTransition } from "@/components/page-transition";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { isLanguage, type LanguageCode } from "@/lib/languages";
import { LanguagePicker } from "@/components/language-picker";
import { PublicTranslation } from "@/components/public-translation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Menu,
  X,
  Instagram,
  MapPin,
  ArrowRight,
} from "lucide-react";
export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="Auromode home">
      <img
        className="brand-logo"
        src="/logo%20Auromode.png"
        alt="Auromode"
        width={244}
        height={140}
      />
    </Link>
  );
}
export function SiteShell({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [locale, setLocale] = useState<LanguageCode>("en");
  const [translationError, setTranslationError] = useState("");
  const [translating, setTranslating] = useState(false);
  useEffect(() => {
    setOpen(false);
    const query = new URLSearchParams(window.location.search).get("lang");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("auromode-language");
    } catch {}
    const wanted = query || saved || "en";
    if (isLanguage(wanted)) {
      setLocale(wanted);
      if (query) {
        try {
          localStorage.setItem("auromode-language", wanted);
        } catch {}
      }
    }
  }, [path]);
  const changeLanguage = useCallback((value: LanguageCode) => {
    setTranslationError("");
    setLocale(value);
    try {
      localStorage.setItem("auromode-language", value);
    } catch {}
    const url = new URL(window.location.href);
    if (value === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", value);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const translationFailed = useCallback((message: string) => {
    setTranslating(false);
    setTranslationError(message);
    setLocale("en");
  }, []);
  return (
    <>
      <div className="announcement">
        A little closer to nature. A little closer to yourself.{" "}
        <span>Welcome to Auroville.</span>
      </div>
      <header className="header">
        <Logo />
        <motion.nav
          initial={false}
          animate={{ opacity: open && !reduce ? [0.7, 1] : 1 }}
          transition={{ duration: 0.2 }}
          aria-label="Main navigation"
          className={open ? "main-nav open" : "main-nav"}
        >
          {[
            ["Home", "/"],
            ["Our Story", "/about"],
            ["Stay", "/guesthouse"],
            ["Work, Eat & More", "/amenities"],
            ["Explore Auroville", "/explore"],
            ["Contact", "/contact"],
          ].map(([name, url]) => (
            <Link
              key={url}
              className={(url === "/" ? path === "/" : path.startsWith(url)) ? "active" : ""}
              href={url}
              onClick={() => setOpen(false)}
            >
              {name}
            </Link>
          ))}
        </motion.nav>
        <div className="header-actions">
          {!path.startsWith("/admin") && (
            <LanguagePicker value={locale} onChange={changeLanguage} />
          )}
          <Link className="button button-small" href="/book">
            Book your stay <ArrowUpRight size={15} />
          </Link>
          <MotionButton
            className="menu-button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </MotionButton>
        </div>
      </header>
      <PublicTranslation
        language={locale}
        path={path}
        onError={translationFailed}
        onBusy={setTranslating}
      />
      {(translating || translationError) && (
        <div className="translation-status" translate="no" role="status">
          {translating ? "Translating page..." : translationError}
          {translationError && (
            <button
              type="button"
              onClick={() => setTranslationError("")}
              aria-label="Dismiss translation notice"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      <PageTransition>{children}</PageTransition>
      <footer>
        <div className="footer-top">
          <div>
            <Logo />
            <p>
              A place to stay. A way to be.
              <br />
              Rooted in Auroville, open to the world.
            </p>
          </div>
          <div>
            <span className="eyebrow">FIND YOUR WAY</span>
            <Link href="/about">Our story</Link>
            <Link href="/guesthouse">Stay with us</Link>
            <Link href="/amenities">Life on campus</Link>
            <Link href="/explore">Explore Auroville</Link>
          </div>
          <div>
            <span className="eyebrow">LET’S CONNECT</span>
            <a href="tel:+914132622224">+91 413 262 22 24</a>
            <a href="mailto:avapart@gmail.com">avapart@gmail.com</a>
            <a
              href="https://wa.me/917871562343"
              target="_blank"
              rel="noreferrer"
            >
              Chat on WhatsApp <ArrowUpRight size={14} />
            </a>
            <span className="footer-note">Mon – Sat · 9:30 AM – 5:00 PM</span>
          </div>
          <div>
            <span className="eyebrow">COME FIND US</span>
            <p>
              Auromode, Auroshilpam
              <br />
              Auroville 605101
              <br />
              Tamil Nadu, India
            </p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Auromode+Auroville"
              target="_blank"
              rel="noreferrer"
            >
              Get directions <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Auromode Auroville</span>
          <span>Made for a more mindful way of living.</span>
          <Link href="/contact">
            Privacy & booking enquiries <ArrowRight size={13} />
          </Link>
        </div>
      </footer>
    </>
  );
}
