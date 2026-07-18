import { Link, useNavigate } from "react-router-dom";
import { Brand } from "./Brand";
import { useAuth } from "../auth/AuthContext";

type SiteNavProps = {
  variant?: "dark" | "light";
};

export function SiteNav({ variant = "dark" }: SiteNavProps) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <nav className={`site-nav site-nav-${variant}`}>
      <div className="site-nav-inner">
        <Brand />
        <div className="site-nav-links">
          <a className="nav-link" href="/#features">
            Features
          </a>
          <a className="nav-link" href="/#how-it-works">
            How it works
          </a>
          <Link className="nav-link" to="/plans">
            Plans
          </Link>
          {isAuthenticated ? (
            <>
              <Link className="nav-link nav-cta" to="/chat">
                Open assistant
              </Link>
              <button type="button" className="nav-link" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link className="nav-link nav-cta" to="/login">
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
