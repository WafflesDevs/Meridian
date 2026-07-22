import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { SiteNav } from "../components/SiteNav";
import { Credits } from "../components/Credits";
import { checkHealth } from "../api";
import logo from "../assets/logo.png";
import creator from "../assets/creator.png";

const FEATURES = [
  {
    id: "grounded",
    category: "Safety",
    title: "Answers from your documents only",
    text: "Meridian looks up your curated PDFs — guidelines, labels, handbooks — and refuses to invent facts from the open web.",
    detail:
      "Every reply is retrieved from your indexed corpus first. Outside web knowledge is blocked by design, so the assistant stays inside the materials you trust.",
    icon: "◈",
  },
  {
    id: "honest",
    category: "Safety",
    title: "Honest when the evidence isn’t there",
    text: "If your corpus doesn’t cover the question, it says “I don’t know” instead of guessing. Safer for clinical reference.",
    detail:
      "When retrieval comes back empty or weak, Meridian refuses to invent an answer. That honesty is the point — better a clear gap than a confident hallucination.",
    icon: "◎",
  },
  {
    id: "agentic",
    category: "Reasoning",
    title: "Thinks before it answers",
    text: "It searches your library first, can rephrase a question and search again, then replies only from what it actually found.",
    detail:
      "An agentic RAG loop decides when to search, can reformulate the query, and only drafts after evidence lands — like a careful research pass, not a one-shot autocomplete.",
    icon: "⟳",
  },
  {
    id: "multipart",
    category: "Reasoning",
    title: "Handles multi-part clinical questions",
    text: "Ask about dosing and side effects in one go — Meridian looks up each part separately so nothing important gets skipped.",
    detail:
      "Compound questions are broken into lookups so dosing, contraindications, and monitoring each get their own pass through the knowledge base.",
    icon: "⊞",
  },
  {
    id: "thread",
    category: "Workflow",
    title: "Follow-ups that feel like a consult",
    text: "“What about in renal impairment?” stays in the same thread. No need to restate the whole case every time.",
    detail:
      "Thread memory keeps context across turns, so clarifying questions feel like a consult — not a cold restart of the case each time.",
    icon: "⇄",
  },
  {
    id: "citations",
    category: "Workflow",
    title: "Grounded in the page, not vibes",
    text: "Every lookup is tied back to passages in your indexed materials, so answers stay anchored to real source text.",
    detail:
      "Cited sources show document + page under each answer so you can jump back to the passage and verify before you act on it.",
    icon: "¶",
  },
  {
    id: "corpus",
    category: "Corpus",
    title: "Built for dense medical PDFs",
    text: "Long textbooks and product inserts are broken into searchable passages — so you get the right section, not a random page.",
    detail:
      "Chunking + vector search over nursing, pharmacology, CDC, and WHO references turns thousand-page PDFs into precise, retrievable passages.",
    icon: "▣",
  },
  {
    id: "desk",
    category: "Corpus",
    title: "Calm desk-side interface",
    text: "A quiet chat workspace designed for serious reference work — not a flashy consumer chatbot.",
    detail:
      "The clinical desk UI keeps saved consultations, knowledge-base links, and grounded replies in one focused workspace — built for desk-side use.",
    icon: "✚",
  },
];

const FEATURE_CATEGORIES = ["All", "Safety", "Reasoning", "Workflow", "Corpus"] as const;

const STEPS = [
  {
    n: "01",
    title: "Ask a question",
    text: "Ask about a medicine or condition in plain language — including follow-ups in the same thread.",
  },
  {
    n: "02",
    title: "Agent searches your docs",
    text: "Meridian’s agent calls a search tool over your curated PDF knowledge base — and can retry with a sharper query.",
  },
  {
    n: "03",
    title: "Get a grounded answer",
    text: "Meridian answers from those sources only — or says “I don’t know” when the docs don’t cover it.",
  },
];

const DEMO_LINES = [
  { role: "user" as const, text: "What is metformin typically used for?" },
  {
    role: "assistant" as const,
    text: "Metformin is commonly used to help manage type 2 diabetes by improving blood sugar control. Your documents note it as a first-line option in many care pathways.",
  },
  { role: "user" as const, text: "Any common side effects?" },
  {
    role: "assistant" as const,
    text: "Based on the indexed label material, gastrointestinal effects such as nausea or diarrhea are among the more frequently reported reactions. Confirm details in your source documents.",
  },
];

const DEMO_STATUS = [
  "Searching…",
  "Querying documents…",
  "Reading passages…",
  "Drafting answer…",
];

export function Landing() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [online, setOnline] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [demoStatus, setDemoStatus] = useState(DEMO_STATUS[0]);
  const [demoTyping, setDemoTyping] = useState(false);
  const [featureCategory, setFeatureCategory] =
    useState<(typeof FEATURE_CATEGORIES)[number]>("All");
  const [activeFeatureId, setActiveFeatureId] = useState(FEATURES[0].id);

  const filteredFeatures =
    featureCategory === "All"
      ? FEATURES
      : FEATURES.filter((f) => f.category === featureCategory);
  const activeFeature =
    filteredFeatures.find((f) => f.id === activeFeatureId) ??
    filteredFeatures[0] ??
    FEATURES[0];

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      checkHealth().then((ok) => {
        if (!cancelled) {
          setOnline(ok);
          setStatusReady(true);
        }
      });
    };
    ping();
    const id = window.setInterval(ping, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(0);
    setDemoTyping(false);
    let i = 0;
    let statusTimer: number | undefined;
    let typingTimer: number | undefined;

    const revealNext = () => {
      // Before each assistant reply, briefly show status typing.
      if (i < DEMO_LINES.length && DEMO_LINES[i].role === "assistant") {
        setDemoTyping(true);
        setDemoStatus(DEMO_STATUS[0]);
        let step = 0;
        window.clearInterval(statusTimer);
        statusTimer = window.setInterval(() => {
          step = Math.min(step + 1, DEMO_STATUS.length - 1);
          setDemoStatus(DEMO_STATUS[step]);
        }, 350);

        typingTimer = window.setTimeout(() => {
          window.clearInterval(statusTimer);
          setDemoTyping(false);
          i += 1;
          setVisibleCount(i);
          if (i < DEMO_LINES.length) {
            typingTimer = window.setTimeout(revealNext, 700);
          }
        }, 1400);
        return;
      }

      i += 1;
      setVisibleCount(i);
      if (i < DEMO_LINES.length) {
        typingTimer = window.setTimeout(revealNext, 900);
      }
    };

    const start = window.setTimeout(revealNext, 600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(typingTimer);
      window.clearInterval(statusTimer);
    };
  }, []);

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-visual" aria-hidden>
          <svg viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="320" cy="320" r="220" stroke="rgba(232,243,239,0.12)" strokeWidth="1.5" />
            <circle cx="320" cy="320" r="150" stroke="rgba(61,184,160,0.35)" strokeWidth="1.5" />
            <path
              className="signal-path"
              d="M120 340 C180 260, 240 420, 300 320 S420 220, 520 300"
              stroke="#3DB8A0"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M140 380 C210 300, 260 450, 330 350 S450 280, 540 360"
              stroke="rgba(232,243,239,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="300" cy="320" r="6" fill="#3DB8A0" />
            <circle className="orbit-dot" cx="420" cy="280" r="4" fill="rgba(232,243,239,0.8)" />
          </svg>
        </div>

        <SiteNav variant="dark" />

        <section className="hero">
          <div className="hero-copy">
            <p
              className={`hero-status ${statusReady ? (online ? "is-online" : "is-offline") : "is-checking"}`}
              aria-live="polite"
            >
              <span className="hero-status-dot" aria-hidden />
              <span className="hero-status-text">
                {!statusReady
                  ? "Checking assistant…"
                  : online
                    ? "Assistant online"
                    : "Assistant offline"}
              </span>
            </p>
            <h1 className="hero-brand">Meridian</h1>
            <p className="hero-version">Version 1.7</p>
            <p className="hero-line">
              Grounded answers on medicines and conditions — drawn only from your
              curated medical documents.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary" to="/chat">
                Start a consultation
              </Link>
              <a className="btn btn-ghost" href="#features">
                See features
              </a>
            </div>
          </div>
        </section>
      </div>

      <section className="demo-section" aria-label="Product preview">
        <div className="demo-inner">
          <div className="demo-copy">
            <h2>Built like a clinical desk assistant</h2>
            <p>
              Thread-aware chat, document-grounded replies, and a calm interface
              designed for serious medical reference — not generic chatbot fluff.
            </p>
            <Link className="btn btn-primary" to="/chat">
              Open the assistant
            </Link>
          </div>

          <div className="demo-chat" aria-hidden={false}>
            <header className="demo-chat-top">
              <Brand to="/chat" />
              <span className={`status-dot ${online ? "online" : ""}`}>
                <i />
                {online ? "Assistant online" : "Connecting…"}
              </span>
            </header>

            <div className="demo-chat-main">
              <div className="messages demo-messages">
                {DEMO_LINES.slice(0, visibleCount).map((line, idx) => (
                  <div key={`${line.role}-${idx}`} className={`message ${line.role}`}>
                    {line.role === "assistant" ? (
                      <img
                        className="message-avatar"
                        src={logo}
                        alt=""
                        aria-hidden
                      />
                    ) : null}
                    <div className="message-body">
                      <span
                        className={
                          line.role === "assistant"
                            ? "message-label message-label-meridian"
                            : "message-label"
                        }
                      >
                        {line.role === "user" ? "You" : "Meridian"}
                      </span>
                      <div className="bubble">{line.text}</div>
                    </div>
                  </div>
                ))}

                {demoTyping && (
                  <div className="message assistant">
                    <img
                      className="message-avatar"
                      src={logo}
                      alt=""
                      aria-hidden
                    />
                    <div className="message-body">
                      <span className="message-label message-label-meridian">
                        Meridian
                      </span>
                      <div className="bubble">
                        <div className="agent-status">
                          <span className="agent-status-dot" />
                          {demoStatus}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="composer demo-composer">
                <div className="composer-box">
                  <textarea
                    value=""
                    readOnly
                    rows={2}
                    placeholder="Ask about a medicine or condition…"
                    tabIndex={-1}
                  />
                  <Link className="send-btn demo-send" to="/chat">
                    Send
                  </Link>
                </div>
                {demoTyping ? (
                  <p className="composer-status">{demoStatus}</p>
                ) : null}
                <p className="composer-note">
                  Not medical advice. Verify with a clinician and your source
                  documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features" aria-label="Product features">
        <div className="features-inner">
          <h2>Features</h2>
          <p className="features-lead">
            Built for clinicians and learners who need trustworthy answers from
            documents they already trust. Click a capability to explore it.
          </p>

          <div
            className="feature-tabs"
            role="tablist"
            aria-label="Feature categories"
          >
            {FEATURE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={featureCategory === cat}
                className={`feature-tab ${featureCategory === cat ? "is-active" : ""}`}
                onClick={() => {
                  setFeatureCategory(cat);
                  const next =
                    cat === "All"
                      ? FEATURES[0]
                      : FEATURES.find((f) => f.category === cat);
                  if (next) setActiveFeatureId(next.id);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="feature-explorer">
            <ul className="feature-rail" role="list">
              {filteredFeatures.map((feature) => (
                <li key={feature.id}>
                  <button
                    type="button"
                    className={`feature-rail-item ${
                      activeFeature.id === feature.id ? "is-active" : ""
                    }`}
                    onClick={() => setActiveFeatureId(feature.id)}
                    onMouseEnter={() => setActiveFeatureId(feature.id)}
                    aria-pressed={activeFeature.id === feature.id}
                  >
                    <span className="feature-rail-icon" aria-hidden>
                      {feature.icon}
                    </span>
                    <span className="feature-rail-copy">
                      <span className="feature-rail-cat">{feature.category}</span>
                      <span className="feature-rail-title">{feature.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div
              className="feature-spotlight"
              key={activeFeature.id}
              aria-live="polite"
            >
              <span className="feature-spotlight-icon" aria-hidden>
                {activeFeature.icon}
              </span>
              <p className="feature-spotlight-cat">{activeFeature.category}</p>
              <h3>{activeFeature.title}</h3>
              <p className="feature-spotlight-lead">{activeFeature.text}</p>
              <p className="feature-spotlight-detail">{activeFeature.detail}</p>
              <Link className="btn btn-primary feature-spotlight-cta" to="/chat">
                Try this in chat
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="how" id="how-it-works">
        <div className="how-inner">
          <h2>How it works</h2>
          <p className="how-lead">
            From question to grounded answer in three deliberate steps.
          </p>
          <ol className="how-steps">
            {STEPS.map((step, index) => (
              <li key={step.n} style={{ animationDelay: `${index * 0.08}s` }}>
                <span className="how-num">{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="how-cta">
            <Link className="btn btn-primary" to="/chat">
              Try Meridian
            </Link>
            <Link className="btn btn-ink" to="/plans">
              View plans
            </Link>
          </div>
        </div>
      </section>

      <section className="promise">
        <div className="promise-inner">
          <h2>What makes Meridian different</h2>
          <ul className="promise-list">
            <li>
              <strong>Grounded only</strong>
              <span>Answers come from your indexed documents — not the open web.</span>
            </li>
            <li>
              <strong>Honest refusals</strong>
              <span>If the corpus isn’t enough, Meridian says it doesn’t know.</span>
            </li>
            <li>
              <strong>Thread memory</strong>
              <span>Follow-ups stay in context so conversations feel natural.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="creator" id="creator" aria-label="Meet the creator">
        <div className="creator-inner">
          <h2>Meet the creator</h2>
          <div className="creator-card">
            <div className="creator-avatar">
              <img src={creator} alt="Ayaan Ali" width={132} height={132} />
            </div>
            <p className="creator-name">Ayaan Ali</p>
            <p className="creator-role">
              Creator of Meridian · AI &amp; Full-Stack Developer
            </p>
            {/* TODO: Ayaan — edit your bio here */}
            <p className="creator-bio">
              A full-stack developer building production-grade AI applications.
              Ayaan created Meridian — a grounded medical Q&amp;A assistant powered
              by FastAPI, LangChain, and Supabase/pgvector with a React front end
              — engineered to answer only from trusted documents, never guesswork.
            </p>
            <div className="creator-links">
              <a
                className="btn btn-primary"
                href="https://github.com/WafflesDevs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ayaan Ali on GitHub (opens in a new tab)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5Z" />
                </svg>
                GitHub
              </a>
              <a
                className="btn btn-ghost"
                href="https://www.linkedin.com/in/ayaan-ali-b5b0b2415/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ayaan Ali on LinkedIn (opens in a new tab)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z" />
                </svg>
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <Brand />
          <p id="disclaimer">
            Educational information only — not a diagnosis or medical advice.
            Always consult a licensed clinician.
          </p>
          <div className="site-footer-links">
            <a href="#features">Features</a>
            <Link to="/plans">Plans</Link>
            <Link to="/chat">Assistant</Link>
          </div>
          <Credits />
        </div>
      </footer>
    </div>
  );
}
