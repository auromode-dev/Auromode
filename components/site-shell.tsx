"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localized } from "@/lib/locales";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const locale = path === "/fr" ? "fr" : path === "/ta" ? "ta" : "en";
  const copy = locale === "en" ? null : localized[locale];
  useEffect(() => {
    setOpen(false);
    document.documentElement.lang = locale;
  }, [path, locale]);
  return (
    <>
      <div className="announcement">
        {copy?.welcome || (
          <>
            A little closer to nature. A little closer to yourself.{" "}
            <span>Welcome to Auroville.</span>
          </>
        )}
      </div>
      <header className="header">
        <Logo />
        <nav
          aria-label="Main navigation"
          className={open ? "main-nav open" : "main-nav"}
        >
          {[
            ["Our Story", "/about"],
            ["Stay", "/guesthouse"],
            ["Work, Eat & More", "/amenities"],
            ["Explore Auroville", "/explore"],
            ["Contact", "/contact"],
          ].map(([name, url]) => (
            <Link
              key={url}
              className={path.startsWith(url) ? "active" : ""}
              href={
                copy
                  ? "#" +
                    ["story", "stay", "campus", "explore", "contact"][
                      [
                        "/about",
                        "/guesthouse",
                        "/amenities",
                        "/explore",
                        "/contact",
                      ].indexOf(url)
                    ]
                  : url
              }
              onClick={() => setOpen(false)}
            >
              {copy
                ? copy.nav[
                    [
                      "/about",
                      "/guesthouse",
                      "/amenities",
                      "/explore",
                      "/contact",
                    ].indexOf(url)
                  ]
                : name}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <select
            className="language-select"
            aria-label="Language"
            value={locale}
            onChange={(e) =>
              router.push(e.target.value === "en" ? "/" : "/" + e.target.value)
            }
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="ta">தமிழ்</option>
          </select>
          <Link className="button button-small" href={copy ? "#stay" : "/book"}>
            {copy?.book || "Book your stay"} <ArrowUpRight size={15} />
          </Link>
          <button
            className="menu-button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">{children}</main>
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
