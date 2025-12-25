from __future__ import annotations
import time
from typing import Any, Dict, Optional
from dataclasses import dataclass


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    def __init__(self):
        self._store: Dict[str, CacheEntry] = {}

    def _now(self) -> float:
        return time.time()

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at < self._now():
            # expired
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        self._store[key] = CacheEntry(value=value, expires_at=self._now() + ttl_seconds)

    def clear(self, prefix: Optional[str] = None) -> None:
        if prefix is None:
            self._store.clear()
            return
        for k in list(self._store.keys()):
            if k.startswith(prefix):
                self._store.pop(k, None)


# Global cache instance for convenience
cache = TTLCache()


def cache_key(subject: str, term: str) -> str:
    s = (subject or '').strip().lower().replace(' ', '_')
    t = (term or '').strip().lower().replace(' ', '_')
    return f"papers:{s}:{t}"
