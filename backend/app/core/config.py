import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hybrid Portfolio Rebalancing System"
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "portfolio_db")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
        if os.getenv("POSTGRES_SERVER")
        else "sqlite:///./rebalance.db"
    )
    
    
    CHROMA_DB_URL: str = os.getenv("CHROMA_DB_URL", "http://localhost:8000")
    
    # External APIs
    ALPHAVANTAGE_API_KEY: str = os.getenv("ALPHAVANTAGE_API_KEY", "9QYG5R7WWHOVNJ2M")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "d6896c1r01qi2if78q3gd6896c1r01qi2if78q40")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # Email
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
settings = Settings()
