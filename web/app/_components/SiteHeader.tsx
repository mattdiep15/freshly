"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { CAMERA_FILE_EVENT } from "@/app/_components/cameraFile";
import { ThemeToggle } from "@/app/_components/ThemeToggle";

const pageTitles: Record<string, string> = {
  "/": "today",
  "/fridge": "my fridge",
  "/scan": "scan",
  "/stats": "stats",
  "/friends": "friends",
};

function NavLink({ href, className, pathname, children }: {
  href: string;
  className: string;
  pathname: string;
  children: ReactNode;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`nav-link ${className} ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="freshly home">
        <Image className="logo-mark" src="/brand/fridge-logo.png" width={342} height={557} alt="" aria-hidden="true" />
        <span>freshly</span>
      </Link>
      <span className="mobile-page-title">{pageTitles[pathname] ?? ""}</span>
      <nav aria-label="Primary navigation">
        <NavLink href="/fridge" className="nav-fridge" pathname={pathname}>
          fridge
        </NavLink>
        <NavLink href="/scan" className="nav-scan" pathname={pathname}>
          <span className="desktop-label">scan receipt</span>
          <span className="mobile-label">scan</span>
        </NavLink>
        <NavLink href="/stats" className="nav-stats" pathname={pathname}>
          stats
        </NavLink>
        <span className="nav-camera-spacer" aria-hidden="true" />
        <NavLink href="/friends" className="nav-friends" pathname={pathname}>
          friends
        </NavLink>
        <button
          className="camera-tab"
          aria-label="Scan a receipt"
          onClick={() => {
            router.push("/scan");
            cameraInputRef.current?.click();
          }}
        >
          <svg viewBox="0 0 32 26" aria-hidden="true">
            <path d="M3 7.5h6l2.2-3h9.4l2.3 3H29v16H3z" />
            <path d="M11 15.4c0-3 2.2-5.3 5.1-5.3s5.1 2.3 5.1 5.3-2.2 5.2-5.1 5.2-5.1-2.2-5.1-5.2z" />
          </svg>
        </button>
        <NavLink href="/" className="nav-me" pathname={pathname}>
          me
        </NavLink>
        <input
          ref={cameraInputRef}
          className="camera-tab-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) window.dispatchEvent(new CustomEvent(CAMERA_FILE_EVENT, { detail: file }));
            event.currentTarget.value = "";
          }}
        />
      </nav>
      <ThemeToggle />
    </header>
  );
}
