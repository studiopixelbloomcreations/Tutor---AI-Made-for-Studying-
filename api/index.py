from main import app as _app

# Vercel mounts Python functions under /api.
# Ensure FastAPI generates correct URLs and handles the mounted prefix.
_app.root_path = "/api"

app = _app
