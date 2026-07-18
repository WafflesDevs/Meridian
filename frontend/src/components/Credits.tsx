const LINKEDIN_URL = "https://www.linkedin.com/in/ayaan-ali-b5b0b2415/";
const GITHUB_URL = "https://github.com/WafflesDevs";

type CreditsProps = {
  variant?: "footer" | "compact";
};

export function Credits({ variant = "footer" }: CreditsProps) {
  return (
    <div className={variant === "compact" ? "credits credits-compact" : "credits"}>
      <span className="credits-by">
        Built by <span className="credits-brand">WafflesDevs</span>
      </span>
      <span className="credits-links">
        <a
          className="credits-link"
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WafflesDevs on LinkedIn (opens in a new tab)"
        >
          LinkedIn
        </a>
        <a
          className="credits-link"
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WafflesDevs on GitHub (opens in a new tab)"
        >
          GitHub
        </a>
      </span>
    </div>
  );
}
