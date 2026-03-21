# Portfolio Optimizer

Full-stack portfolio construction platform: quant engine (Python) + REST API (FastAPI) + dashboard (React).

## Quick Start

**Terminal 1 — Backend**
```bash
cd Portfolio_platform
source ../.venv/bin/activate   # or: ../.venv/bin/python run.py
python run.py
# → http://127.0.0.1:8000  (Swagger UI: /docs)
```

**Terminal 2 — Frontend**
```bash
cd Portfolio_platform/frontend
npm install
npm run dev
# → http://localhost:3000
```

## Structure

```
Portfolio_platform/
├── portfolio_engine/      # Quant package (Portfolio, Optimizer, Backtest)
│   ├── data.py
│   ├── parameters.py
│   ├── optimizer.py
│   ├── backtest.py
│   └── utils.py
├── api/                   # FastAPI application
│   ├── main.py
│   ├── routers/
│   │   ├── assets.py      # GET /api/assets/search  POST /api/assets/prices
│   │   ├── optimize.py    # POST /api/optimize
│   │   └── backtest.py    # POST /api/backtest
│   └── schemas/
│       ├── requests.py
│       └── responses.py
├── frontend/              # React + Vite + Tailwind dashboard
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   └── package.json
├── run.py                 # Uvicorn entry point
└── requirements.txt
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/assets/search?query=` | Ticker search |
| POST | `/api/assets/prices` | Historical prices |
| POST | `/api/optimize` | Single portfolio or efficient frontier |
| POST | `/api/backtest` | Walk-forward backtest |

## Requirements

- Python ≥ 3.11 with packages from `requirements.txt`
- Node.js ≥ 18

```bash
# Python deps
pip install -r requirements.txt

# Node deps
cd frontend && npm install
```
