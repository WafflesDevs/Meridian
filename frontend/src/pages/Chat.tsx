import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { checkHealth, fetchSources, sendChat } from "../api";
import type { Source } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Credits } from "../components/Credits";
import { ThemeToggle } from "../components/ThemeToggle";
import logo from "../assets/logo.png";

function cleanDocName(filename: string): string {
  let name = filename.replace(/\.pdf$/i, "");
  name = name.replace(/[-_\s]+web$/i, "");
  name = name.replace(/[_-]+/g, " ");
  name = name.replace(/\s+/g, " ").trim();
  return name || filename;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const SUGGESTIONS = [
  "What is this medicine used for?",
  "What are common side effects?",
  "How should this be taken?",
];

const STATUS_STEPS = [
  "Searching…",
  "Querying documents…",
  "Reading passages…",
  "Drafting answer…",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    checkHealth().then(setOnline);
    fetchSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, statusText]);

  useEffect(() => {
    if (!loading) {
      setStatusText("");
      return;
    }

    let step = 0;
    setStatusText(STATUS_STEPS[0]);
    const id = window.setInterval(() => {
      step = Math.min(step + 1, STATUS_STEPS.length - 1);
      setStatusText(STATUS_STEPS[step]);
      if (step >= STATUS_STEPS.length - 1) window.clearInterval(id);
    }, 1400);

    return () => window.clearInterval(id);
  }, [loading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    setLoading(true);

    try {
      const data = await sendChat(trimmed, threadId);
      setThreadId(data.thread_id);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          sources: data.sources ?? [],
        },
      ]);
      setOnline(true);
    } catch (err) {
      setOnline(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function askAboutDocument(name: string) {
    const clean = cleanDocName(name);
    setInput(`Give me an overview of what "${clean}" covers.`);
    textareaRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
    }
  }

  return (
    <div className="chat-page">
      <header className="chat-top">
        <Brand />
        <div className="chat-meta">
          <span className={`status-dot ${online ? "online" : ""}`}>
            <i />
            {online ? "Assistant online" : "Connecting…"}
          </span>
          {user && (
            <span className="chat-user" title={user.user_id}>
              {user.email && (
                <span className="chat-user-email">{user.email}</span>
              )}
              <span className="chat-user-role">{user.role}</span>
            </span>
          )}
          <Link className="nav-link" to="/plans" style={{ color: "var(--muted)" }}>
            Plans
          </Link>
          <Link className="nav-link" to="/" style={{ color: "var(--muted)" }}>
            Home
          </Link>
          <button type="button" className="chat-logout" onClick={onLogout}>
            Log out
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="chat-layout">
        <aside className="sources-panel">
          <h2>Knowledge base</h2>
          <p>Answers are grounded in these uploaded documents.</p>
          {sources.length === 0 ? (
            <p className="sources-empty">
              No documents indexed yet. Add PDFs on the backend and ingest them
              into Supabase.
            </p>
          ) : (
            <ul className="sources-list">
              {sources.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="source-item"
                    onClick={() => askAboutDocument(name)}
                    title={`Ask about ${cleanDocName(name)}`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="chat-main">
          <div className="messages">
            {messages.length === 0 && !loading ? (
              <div className="welcome-panel">
                <h1>Ask Meridian</h1>
                <p>
                  Get concise, document-grounded information about medicines and
                  conditions. Follow-up questions stay in this thread.
                </p>
                <div className="suggestions">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="suggestion"
                      onClick={() => void ask(text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  {msg.role === "assistant" ? (
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
                        msg.role === "assistant"
                          ? "message-label message-label-meridian"
                          : "message-label"
                      }
                    >
                      {msg.role === "user" ? "You" : "Meridian"}
                    </span>
                    <div className="bubble">{msg.content}</div>
                    {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 ? (
                      <p className="message-sources">
                        <span className="message-sources-label">Sources:</span>{" "}
                        {msg.sources.map((s) => s.label).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {loading && (
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
                    <div className="agent-status" aria-live="polite">
                      <span className="agent-status-dot" />
                      {statusText || "Working…"}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="composer">
            {error && <div className="error-banner">{error}</div>}
            <form className="composer-box" onSubmit={onSubmit}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about a medicine or condition…"
                rows={2}
                disabled={loading}
              />
              <button
                className="send-btn"
                type="submit"
                disabled={loading || !input.trim()}
              >
                Send
              </button>
            </form>
            {loading && statusText ? (
              <p className="composer-status" aria-live="polite">
                {statusText}
              </p>
            ) : null}
            <p className="composer-note">
              Not medical advice. Verify with a clinician and your source
              documents.
              {threadId ? ` · Thread ${threadId.slice(0, 8)}…` : ""}
            </p>
            <Credits variant="compact" />
          </div>
        </section>
      </div>
    </div>
  );
}
