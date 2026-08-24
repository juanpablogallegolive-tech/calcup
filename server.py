"""Entrada ASGI para Render (raíz del repo)."""
import os
import uvicorn
from backend.server import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("backend.server:app", host=host, port=port)
