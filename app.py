"""
Entrada ASGI/WSGI principal y ejecutable (app.py).
Exporta la variable `app` (FastAPI) desde `backend.server` para compatibilidad con Uvicorn/Render.
"""
import os
import uvicorn
from backend.server import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"🚀 Iniciando CalcuP Backend via app.py en http://{host}:{port}")
    uvicorn.run("app:app", host=host, port=port)
