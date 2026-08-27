"""
Módulo backend/app.py que re-exporta la instancia `app` de FastAPI desde backend.server.
"""
from backend.server import app

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("backend.app:app", host=host, port=port)
