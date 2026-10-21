"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import s from "./Nav.module.css";

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/fitter", label: "For wig fitters" },
  { href: "/journal", label: "Journal" },
  { href: "/business", label: "For retailers" },
  { href: "/evidence", label: "Evidence" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => { setOpen(false); document.body.style.overflow = ""; };

  return (
    <header className={s.bar}>
      <div className={`wrap ${s.inner}`}>
        <Link href="/" className={s.logo} onClick={close} aria-label="Hairloom home">
          <Mark /> Hairloom
        </Link>
        <nav aria-label="Main" className={s.links}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>
        <Link href="/studio" className={`btn btn-ivory btn-sm ${s.cta}`}>Open the studio</Link>
        <button className={s.menuBtn} aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="menu" className={s.sheet}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close}>{l.label}</Link>
          ))}
          <Link href="/studio" className="btn btn-ivory" onClick={close}>Open the studio</Link>
        </div>
      )}
    </header>
  );
}

/** An arch mirror, the product's mark. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size * 0.72} height={size} viewBox="0 0 18 25" aria-hidden="true">
      <path d="M1.5 24V9a7.5 7.5 0 0 1 15 0v15z" fill="none" stroke="var(--brass)" strokeWidth="1.6" />
      <path d="M5 21V10.2a4 4 0 0 1 8 0V21" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".55" />
    </svg>
  );
}
