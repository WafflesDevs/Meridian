"""Simple in-memory chat history keyed by thread_id."""

from collections import defaultdict

# thread_id -> list of {"role": "user"|"assistant", "content": str}
_THREADS: dict[str, list[dict[str, str]]] = defaultdict(list)

MAX_TURNS = 6  # keep last 6 messages (3 user + 3 assistant)


def get_history(thread_id: str) -> list[dict[str, str]]:
    return list(_THREADS.get(thread_id, []))


def add_turn(thread_id: str, question: str, answer: str) -> None:
    _THREADS[thread_id].append({"role": "user", "content": question})
    _THREADS[thread_id].append({"role": "assistant", "content": answer})
    _THREADS[thread_id] = _THREADS[thread_id][-MAX_TURNS:]


def format_history(history: list[dict[str, str]]) -> str:
    if not history:
        return "None"
    lines = []
    for msg in history:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)
