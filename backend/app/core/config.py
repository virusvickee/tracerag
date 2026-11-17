from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "TraceRAG API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql+asyncpg://evallens:evallens_secret@localhost:5432/evallens"
    OPENAI_API_KEY: str = ""
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"
    DEFAULT_JUDGE_MODEL: str = "gpt-4o-mini"
    MAX_CONCURRENT_EVALS: int = 5
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
