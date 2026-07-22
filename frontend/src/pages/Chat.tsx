import { useEffect, useRef, useState, useCallback } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { checkHealth, fetchSources, sendChat, MAX_PROMPT_CHARS } from "../api";
import type { Source } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Credits } from "../components/Credits";
import { ThemeToggle } from "../components/ThemeToggle";
import logo from "../assets/logo.png";
import {
  MAX_SAVED_CHATS,
  type ChatMessage,
  type SavedChat,
  loadChats,
  saveChats,
  getActiveChatId,
  setActiveChatId,
  createEmptyChat,
  titleFromMessage,
  upsertChat,
  deleteChat,
} from "../chat/history";

function cleanDocName(filename: string): string {
  let name = filename.replace(/\.pdf$/i, "");
  name = name.replace(/[-_\s]+web$/i, "");
  name = name.replace(/[_-]+/g, " ");
  name = name.replace(/\s+/g, " ").trim();
  return name || filename;
}

const SOURCE_PDF_URLS: Record<string, string> = {
  "microbiology_-_WEB.pdf":
    "https://assets.openstax.org/oscms-prodcms/media/documents/microbiology_-_WEB.pdf",
  "medical-surgical-nursing.pdf":
    "https://assets.openstax.org/oscms-prodcms/media/documents/Medical-Surgical_Nursing-WEB.pdf",
  "pharmacology-for-nurses.pdf":
    "https://assets.openstax.org/oscms-prodcms/media/documents/Pharmacology-WEB.pdf",
  "nutrition-for-nurses.pdf":
    "https://assets.openstax.org/oscms-prodcms/media/documents/Nutrition_for_Nurses-WEB.pdf",
  "cdc-pink-book-vaccine-preventable-diseases.pdf":
    "https://stacks.cdc.gov/view/cdc/252997/cdc_252997_DS1.pdf",
  "who-essential-medicines-list-2023.pdf":
    "https://iris.who.int/server/api/core/bitstreams/289a875c-cc89-4914-90ad-eb3c578ebaf6/content",
  "where-there-is-no-doctor.pdf":
    "https://hesperian.org/books-and-resources/where-there-is-no-doctor/",
};

const SUGGESTIONS = [
  {
    label: "Indication",
    text: "What is metformin typically used for?",
    icon: "℞",
  },
  {
    label: "Side effects",
    text: "What are common side effects of ACE inhibitors?",
    icon: "⚠",
  },
  {
    label: "Vaccines",
    text: "What does the CDC Pink Book say about measles vaccination?",
    icon: "✚",
  },
  {
    label: "Nutrition",
    text: "What nutrients support wound healing after surgery?",
    icon: "◎",
  },
];

const STATUS_STEPS = [
  "Auscultating the knowledge base…",
  "Pulling chart notes…",
  "Reviewing passages…",
  "Drafting consult note…",
];

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Chat() {
  const [chats, setChats] = useState<SavedChat[]>(() => loadChats());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = getActiveChatId();
    const existing = loadChats();
    if (saved && existing.some((c) => c.id === saved)) return saved;
    return existing[0]?.id ?? null;
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [kbOpen, setKbOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 901px)").matches
      : true,
  );
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 901px)").matches
      : true,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [limitHint, setLimitHint] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const activeChat = chats.find((c) => c.id === activeId) ?? null;
  const messages = activeChat?.messages ?? [];
  const threadId = activeChat?.threadId ?? null;

  const persist = useCallback((next: SavedChat[]) => {
    setChats(next);
    saveChats(next);
  }, []);

  const closeSidebarOnMobile = useCallback(() => {
    if (!window.matchMedia("(min-width: 901px)").matches) {
      setSidebarOpen(false);
    }
  }, []);

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function startNewChat() {
    if (loading) return;
    const empty = chats.find((c) => c.messages.length === 0);
    if (empty) {
      setActiveId(empty.id);
      setActiveChatId(empty.id);
      setError(null);
      closeSidebarOnMobile();
      return;
    }
    if (chats.length >= MAX_SAVED_CHATS) {
      setLimitHint(true);
      window.setTimeout(() => setLimitHint(false), 3200);
      return;
    }
    const chat = createEmptyChat();
    const next = upsertChat(chats, chat);
    persist(next);
    setActiveId(chat.id);
    setActiveChatId(chat.id);
    setError(null);
    setInput("");
    closeSidebarOnMobile();
  }

  function selectChat(id: string) {
    if (loading) return;
    setActiveId(id);
    setActiveChatId(id);
    setError(null);
    closeSidebarOnMobile();
  }

  function removeChat(id: string) {
    if (loading) return;
    const next = deleteChat(chats, id);
    persist(next);
    if (activeId === id) {
      const fallback = next[0]?.id ?? null;
      setActiveId(fallback);
      setActiveChatId(fallback);
    }
  }

  useEffect(() => {
    checkHealth().then(setOnline);
    fetchSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setSidebarOpen(desktop);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

    let chat = activeChat;
    let list = chats;
    if (!chat) {
      if (list.length >= MAX_SAVED_CHATS) {
        setLimitHint(true);
        window.setTimeout(() => setLimitHint(false), 3200);
        return;
      }
      chat = createEmptyChat();
      list = upsertChat(list, chat);
      setActiveId(chat.id);
      setActiveChatId(chat.id);
    }

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const withUser: SavedChat = {
      ...chat,
      title:
        chat.messages.length === 0
          ? titleFromMessage(trimmed)
          : chat.title,
      messages: [...chat.messages, userMsg],
      updatedAt: Date.now(),
    };
    list = upsertChat(list, withUser);
    persist(list);
    setLoading(true);

    try {
      const data = await sendChat(trimmed, withUser.threadId);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        sources: data.sources ?? [],
      };
      const withAssistant: SavedChat = {
        ...withUser,
        threadId: data.thread_id,
        messages: [...withUser.messages, assistantMsg],
        updatedAt: Date.now(),
      };
      persist(upsertChat(list, withAssistant));
      setOnline(true);
    } catch (err) {
      setOnline(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
      // keep the user message so they can retry
      persist(list);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function copyAnswer(msg: ChatMessage) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* ignore */
    }
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
    <div className="clinic-page">
      <header className="clinic-top">
        <div className="clinic-top-left">
          <button
            type="button"
            className="clinic-icon-btn"
            aria-label={sidebarOpen ? "Hide chat list" : "Show chat list"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 6h16M4 12h16M4 18h10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Brand />
          <span className="clinic-badge">Clinical desk</span>
        </div>
        <div className="clinic-meta">
          <span className={`vitals-pill ${online ? "is-live" : ""}`}>
            <i />
            <span className="vitals-full">
              {online ? "Vitals stable · online" : "Connecting…"}
            </span>
            <span className="vitals-short">
              {online ? "Online" : "…"}
            </span>
          </span>
          {user && (
            <span className="chat-user" title={user.user_id}>
              {user.email && (
                <span className="chat-user-email">{user.email}</span>
              )}
              <span className="chat-user-role">{user.role}</span>
            </span>
          )}
          <Link className="nav-link clinic-nav clinic-nav-text" to="/plans">
            Plans
          </Link>
          <Link className="nav-link clinic-nav clinic-nav-text" to="/">
            Home
          </Link>
          <button type="button" className="chat-logout" onClick={onLogout}>
            Log out
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div
        className={`clinic-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}
      >
        {!isDesktop && sidebarOpen && (
          <button
            type="button"
            className="clinic-sidebar-backdrop"
            aria-label="Close chat list"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className="clinic-sidebar" aria-label="Saved consultations">
          <button
            type="button"
            className="new-consult-btn"
            onClick={startNewChat}
            disabled={loading}
          >
            <span aria-hidden>+</span> New consultation
          </button>
          <div className="clinic-sidebar-head">
            <h2>Saved chats</h2>
            <span className="chat-slot-count">
              {chats.length}/{MAX_SAVED_CHATS}
            </span>
          </div>
          {limitHint && (
            <p className="chat-limit-hint" role="status">
              Limit of {MAX_SAVED_CHATS} chats reached. Delete one to start a new
              consultation.
            </p>
          )}
          {chats.length === 0 ? (
            <p className="clinic-sidebar-empty">
              No saved chats yet. Ask a question to start your first
              consultation.
            </p>
          ) : (
            <ul className="chat-history-list">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`chat-history-item ${
                      c.id === activeId ? "is-active" : ""
                    }`}
                    onClick={() => selectChat(c.id)}
                    disabled={loading}
                  >
                    <span className="chat-history-title">{c.title}</span>
                    <span className="chat-history-meta">
                      {c.messages.length} msg · {formatRelative(c.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="chat-history-delete"
                    aria-label={`Delete ${c.title}`}
                    title="Delete chat"
                    onClick={() => removeChat(c.id)}
                    disabled={loading}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="clinic-kb">
            <button
              type="button"
              className="clinic-kb-toggle"
              onClick={() => setKbOpen((v) => !v)}
              aria-expanded={kbOpen}
            >
              <span>Knowledge base</span>
              <span className="clinic-kb-chevron">{kbOpen ? "▾" : "▸"}</span>
            </button>
            {kbOpen && (
              <div className="clinic-kb-body">
                <p>Grounded answers from these indexed references.</p>
                {sources.length === 0 ? (
                  <p className="sources-empty">No documents indexed yet.</p>
                ) : (
                  <ul className="sources-list">
                    {sources.map((name) => {
                      const pdfUrl = SOURCE_PDF_URLS[name];
                      return (
                        <li key={name}>
                          <div className="source-row">
                            <span className="source-item">
                              {cleanDocName(name)}
                            </span>
                            {pdfUrl && (
                              <a
                                className="source-view"
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`View "${cleanDocName(name)}"`}
                                aria-label={`View ${cleanDocName(name)} PDF`}
                              >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path
                                    d="M14 4h6v6M20 4l-8.5 8.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="clinic-main">
          <div className="clinic-chart-bar" aria-hidden>
            <span className="chart-wave" />
            <span className="chart-label">Meridian consult stream</span>
            <span className="chart-wave chart-wave-r" />
          </div>

          <div className="messages clinic-messages">
            {messages.length === 0 && !loading ? (
              <div className="welcome-clinic">
                <div className="welcome-cross" aria-hidden>
                  <span />
                </div>
                <p className="welcome-kicker">Document-grounded consult</p>
                <h1>Open a clinical question</h1>
                <p>
                  Meridian answers only from your curated medical library —
                  guidelines, formularies, and handbooks. Saved chats live in
                  the sidebar (up to {MAX_SAVED_CHATS}).
                </p>
                <div className="clinic-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      className="clinic-suggestion"
                      onClick={() => void ask(s.text)}
                    >
                      <span className="clinic-suggestion-icon" aria-hidden>
                        {s.icon}
                      </span>
                      <span className="clinic-suggestion-label">{s.label}</span>
                      <span className="clinic-suggestion-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role} clinic-msg`}>
                  {msg.role === "assistant" ? (
                    <img
                      className="message-avatar"
                      src={logo}
                      alt=""
                      aria-hidden
                    />
                  ) : null}
                  <div className="message-body">
                    <div className="message-head">
                      <span
                        className={
                          msg.role === "assistant"
                            ? "message-label message-label-meridian"
                            : "message-label"
                        }
                      >
                        {msg.role === "user" ? "You" : "Meridian"}
                      </span>
                      {msg.role === "assistant" && (
                        <button
                          type="button"
                          className="msg-action"
                          onClick={() => void copyAnswer(msg)}
                        >
                          {copiedId === msg.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                    <div className="bubble">{msg.content}</div>
                    {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 ? (
                      <div className="source-chips">
                        <span className="source-chips-label">Cited</span>
                        {msg.sources.map((s: Source, i) => (
                          <span key={`${s.label}-${i}`} className="source-chip">
                            {s.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="message assistant clinic-msg">
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

          <div className="composer clinic-composer">
            {error && <div className="error-banner">{error}</div>}
            <form className="composer-box clinic-composer-box" onSubmit={onSubmit}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about a medicine, condition, or guideline…"
                rows={2}
                maxLength={MAX_PROMPT_CHARS}
                disabled={loading}
              />
              <button
                className="send-btn clinic-send"
                type="submit"
                disabled={loading || !input.trim()}
              >
                Consult
              </button>
            </form>
            <div className="clinic-composer-footer">
              <p
                className={`composer-counter${
                  input.length >= MAX_PROMPT_CHARS * 0.9 ? " near-limit" : ""
                }`}
                aria-live="polite"
              >
                {input.length} / {MAX_PROMPT_CHARS}
              </p>
              {loading && statusText ? (
                <p className="composer-status" aria-live="polite">
                  {statusText}
                </p>
              ) : (
                <p className="composer-note">
                  Not medical advice. Verify with a clinician.
                  {threadId ? ` · Thread ${threadId.slice(0, 8)}…` : ""}
                </p>
              )}
            </div>
            <Credits variant="compact" />
          </div>
        </section>
      </div>
    </div>
  );
}
