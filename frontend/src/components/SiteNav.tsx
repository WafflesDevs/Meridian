import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../auth/AuthContext";

type SiteNavProps = {
  variant?: "dark" | "light";
};

export function SiteNav({ variant = "dark" }: SiteNavProps) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function onLogout() {
    logout();
    setMenuOpen(false);
    navigate("/", { replace: true });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 861px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <nav className={`site-nav site-nav-${variant}`}>
      <div className="site-nav-inner">
        <Brand />
        <div className="site-nav-actions">
          <div
            id="site-nav-menu"
            className={`site-nav-links ${menuOpen ? "is-open" : ""}`}
          >
            <a className="nav-link" href="/#features" onClick={closeMenu}>
              Features
            </a>
            <a className="nav-link" href="/#how-it-works" onClick={closeMenu}>
              How it works
            </a>
            <Link className="nav-link" to="/plans" onClick={closeMenu}>
              Plans
            </Link>
            {isAuthenticated ? (
              <>
                <Link className="nav-link nav-cta" to="/chat" onClick={closeMenu}>
                  Open assistant
                </Link>
                <button type="button" className="nav-link" onClick={onLogout}>
                  Log out
                </button>
              </>
            ) : (
              <Link className="nav-link nav-cta" to="/login" onClick={closeMenu}>
                Log in
              </Link>
            )}
          </div>
          <ThemeToggle />
          <button
            type="button"
            className={`site-nav-burger ${menuOpen ? "is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-nav-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  );
}
