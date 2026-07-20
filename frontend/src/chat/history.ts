import type { Source } from "../api";

export const MAX_SAVED_CHATS = 5;
const STORAGE_KEY = "meridian-chat-history-v1";
const ACTIVE_KEY = "meridian-active-chat-id";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export type SavedChat = {
  id: string;
  title: string;
  threadId: string | null;
  messages: ChatMessage[];
  updatedAt: number;
  createdAt: number;
};

function safeParse(raw: string | null): SavedChat[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as SavedChat[];
    if (!Array.isArray(data)) return [];
    return data
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
      .slice(0, MAX_SAVED_CHATS);
  } catch {
    return [];
  }
}

export function loadChats(): SavedChat[] {
  return safeParse(localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function saveChats(chats: SavedChat[]): void {
  const trimmed = [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SAVED_CHATS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getActiveChatId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveChatId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function createEmptyChat(): SavedChat {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New consultation",
    threadId: null,
    messages: [],
    updatedAt: now,
    createdAt: now,
  };
}

export function titleFromMessage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New consultation";
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

/** Upsert a chat; if over the limit, drop the oldest (by updatedAt). */
export function upsertChat(chats: SavedChat[], chat: SavedChat): SavedChat[] {
  const without = chats.filter((c) => c.id !== chat.id);
  return [chat, ...without]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SAVED_CHATS);
}

export function deleteChat(chats: SavedChat[], id: string): SavedChat[] {
  return chats.filter((c) => c.id !== id);
}
