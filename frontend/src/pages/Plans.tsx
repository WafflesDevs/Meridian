import { Link } from "react-router-dom";
import { SiteNav } from "../components/SiteNav";
import { Brand } from "../components/Brand";
import { Credits } from "../components/Credits";
import { useAuth } from "../auth/AuthContext";

type Plan = {
  id: string;
  name: string;
  blurb: string;
  price: string;
  tier: "free" | "paid";
  featured?: boolean;
  cta: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "explorer",
    name: "Explorer",
    blurb: "For students and builders validating grounded medical Q&A.",
    price: "Free",
    tier: "free",
    featured: true,
    cta: "Start free",
    features: ["All Features"],
  },
  {
    id: "practitioner",
    name: "Practitioner",
    blurb: "For clinics and teams that need reliable document-grounded answers.",
    price: "TBA",
    tier: "paid",
    cta: "TBA",
    features: ["TBA"],
  },
  {
    id: "institution",
    name: "Institution",
    blurb: "For hospitals, universities, and regulated environments.",
    price: "TBA",
    tier: "paid",
    cta: "TBA",
    features: ["TBA"],
  },
];

export function Plans() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? "/chat" : "/login";

  return (
    <div className="plans-page">
      <SiteNav variant="light" />

      <header className="plans-hero">
        <h1>Plans built for careful medical reference</h1>
        <p>
          Start free on Explorer with every feature unlocked. Paid tiers for
          teams and institutions are on the way.
        </p>
      </header>

      <section className="plans-grid">
        {PLANS.map((plan) => {
          const isFree = plan.tier === "free";
          return (
            <article
              key={plan.id}
              className={`plan-card ${plan.featured ? "featured" : ""}`}
            >
              {plan.featured && <span className="plan-badge">Available now</span>}
              <h2>{plan.name}</h2>
              <p className="plan-blurb">{plan.blurb}</p>
              <div className="plan-price">
                {isFree ? (
                  <span className="amount">Free</span>
                ) : (
                  <span className="amount plan-tba">TBA</span>
                )}
              </div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {isFree ? (
                <Link className="btn btn-primary" to={startHref}>
                  {plan.cta}
                </Link>
              ) : (
                <button className="btn btn-ink" type="button" disabled>
                  {plan.cta}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="plans-note">
        <h2>Not medical advice software</h2>
        <p>
          Meridian is an educational retrieval assistant. It does not diagnose,
          prescribe, or replace a licensed clinician. Paid billing is not live
          yet — Explorer includes all current features.
        </p>
        <Link className="btn btn-primary" to={startHref}>
          Try the assistant
        </Link>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <Brand />
          <p>Educational use only. Consult a licensed clinician for care decisions.</p>
          <div className="site-footer-links">
            <Link to="/">Home</Link>
            <Link to={startHref}>Assistant</Link>
          </div>
          <Credits />
        </div>
      </footer>
    </div>
  );
}
