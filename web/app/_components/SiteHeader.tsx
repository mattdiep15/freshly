"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/fridge", label: "fridge" },
  { href: "/scan", label: "scan receipt" },
  { href: "/stats", label: "stats" },
  { href: "/friends", label: "friends" },
] as const;

function FridgeDoodle() {
  return (
    <svg viewBox="0 0 36 44" aria-hidden="true">
      <path d="M7 3.5h22v36H7zM7 18h22M24.5 9v5M24.5 23v5M11 39.5v2M25 39.5v2" />
      <path d="M4 7c1.2-1.1 1.5-2.4 1-4M31 35c1.7.2 2.5 1 3 2.5" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="freshly home">
        <span className="logo-mark">
          <FridgeDoodle />
        </span>
        <span>freshly</span>
      </Link>
      <nav aria-label="Primary navigation">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${pathname === href ? "active" : ""}`}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
