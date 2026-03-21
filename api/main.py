"""
api/main.py
-----------
FastAPI application factory.

Endpoints
---------
GET  /health
GET  /api/assets/search
POST /api/assets/prices
POST /api/optimize
POST /api/backtest
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import assets, optimize, backtest
from .schemas.responses import HealthResponse

app = FastAPI(
    title="Portfolio Optimisation API",
    description=(
        "REST API for portfolio construction: asset search, price download, "
        "mean-variance / robust optimisation, and walk-forward backtesting."
    ),
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(assets.router)
app.include_router(optimize.router)
app.include_router(backtest.router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=app.version)
