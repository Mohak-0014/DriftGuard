# Hybrid Near–Real-Time Portfolio Rebalancing System

A decision-support platform for portfolio management and rebalancing.

## Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop (for PostgreSQL and ChromaDB)

## Setup

### Database
1. Start PostgreSQL and ChromaDB:
   ```bash
   docker-compose up -d
   ```

### Backend
1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Create virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Initialize Database:
   ```bash
   python -m app.db.init_db
   ```
4. Run Server:
   ```bash
   uvicorn app.main:app --reload
   ```
   API will be available at `http://localhost:8000`.
   Docs at `http://localhost:8000/docs`.

### Frontend
1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Development Server:
   ```bash
   npm run dev
   ```
   App will be available at `http://localhost:5173`.

## Features
- **Dashboard**: View all portfolios.
- **Portfolio Details**: See holdings and current value.
- **Optimization**: Click "Run Optimization" to get rebalancing suggestions based on Mean-Variance Optimization.
