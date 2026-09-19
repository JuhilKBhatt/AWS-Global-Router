"""AWS Global Router FastAPI entrypoint."""

import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment configurations if present
for env_candidate in [
    Path("/app/secrets/.dev.env"),
    Path("/app/secrets/.prod.env"),
    Path(__file__).parent.parent / "secrets" / ".dev.env",
    Path(__file__).parent.parent / "secrets" / ".prod.env",
]:
    if env_candidate.exists():
        load_dotenv(dotenv_path=env_candidate, override=False)

from routers.vpn import router as vpn_router
from routers.parameters import router as parameters_router

app = FastAPI(
    title="AWS Global Router API",
    description="Ephemeral, On-Demand Multi-Region WireGuard VPN Orchestrator Control Plane",
    version="1.0.0",
)

# CORS setup
origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(vpn_router)
app.include_router(parameters_router)


@app.get("/health", tags=["Health"])
def health_check():
    """System health check endpoint."""
    return {"status": "healthy", "service": "aws-global-router-backend"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
