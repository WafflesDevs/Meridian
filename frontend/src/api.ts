const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "meridian_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type Source = {
  filename: string;
  page: number | null;
  label: string;
};

export type ChatResponse = {
  response: string;
  thread_id: string;
  sources: Source[];
};

export type CurrentUser = {
  user_id: string;
  role: string;
  email?: string | null;
};

export type AuthResult = {
  email: string;
  role: string;
};

async function readError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ detail: fallback }));
  if (typeof err?.detail === "string") return err.detail;
  return fallback;
}

export async function signup(
  email: string,
  password: string,
): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/createuser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Could not create account"));
  }
  return res.json();
}

export async function login(
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Invalid email or password"));
  }
  const data = await res.json();
  setToken(data.token);
  return data.token;
}

export async function fetchMe(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_URL}/me`, { headers: authHeaders() });
  if (!res.ok) {
    clearToken();
    return null;
  }
  return res.json();
}

export async function sendChat(
  userinput: string,
  thread_id?: string | null,
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ userinput, thread_id: thread_id ?? null }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      throw new Error("Your session expired. Please log in again.");
    }
    throw new Error(await readError(res, "Failed to get an answer"));
  }

  return res.json();
}

export async function fetchSources(): Promise<string[]> {
  const res = await fetch(`${API_URL}/source`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error("Failed to load sources");
  }
  const data = await res.json();
  return data.sources ?? [];
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
