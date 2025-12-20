from main import app as _app

# Vercel mounts Python functions under /api.
# Ensure FastAPI generates correct URLs and handles the mounted prefix.
_app.root_path = "/api"

class _StripPrefixASGI:
    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope, receive, send):
        if scope.get("type") in {"http", "websocket"}:
            path = scope.get("path") or ""
            if path.startswith(self.prefix):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix) :] or "/"
        await self.app(scope, receive, send)


app = _StripPrefixASGI(_app, "/api")
