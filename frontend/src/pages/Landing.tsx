import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { SiteNav } from "../components/SiteNav";
import { Credits } from "../components/Credits";
import { checkHealth } from "../api";
import logo from "../assets/logo.png";

const FEATURES = [
  {
    title: "Answers from your documents only",
    text: "Meridian looks up your curated PDFs — guidelines, labels, handbooks — and refuses to invent facts from the open web.",
  },
  {
    title: "Honest when the evidence isn’t there",
    text: "If your corpus doesn’t cover the question, it says “I don’t know” instead of guessing. Safer for clinical reference.",
  },
  {
    title: "Thinks before it answers",
    text: "It searches your library first, can rephrase a question and search again, then replies only from what it actually found.",
  },
  {
    title: "Handles multi-part clinical questions",
    text: "Ask about dosing and side effects in one go — Meridian looks up each part separately so nothing important gets skipped.",
  },
  {
    title: "Follow-ups that feel like a consult",
    text: "“What about in renal impairment?” stays in the same thread. No need to restate the whole case every time.",
  },
  {
    title: "Grounded in the page, not vibes",
    text: "Every lookup is tied back to passages in your indexed materials, so answers stay anchored to real source text.",
  },
  {
    title: "Built for dense medical PDFs",
    text: "Long textbooks and product inserts are broken into searchable passages — so you get the right section, not a random page.",
  },
  {
    title: "Calm desk-side interface",
    text: "A quiet chat workspace designed for serious reference work — not a flashy consumer chatbot.",
  },
];

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
            documents they already trust.
          </p>
          <ul className="features-grid">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </li>
            ))}
          </ul>
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
