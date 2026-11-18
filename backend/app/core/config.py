import os
from typing import List
from pydantic import model_validator
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

    @model_validator(mode="after")
    def resolve_docker_db_host(self) -> "Settings":
        # When running inside Docker Compose, localhost refers to the container itself.
        # Map localhost/127.0.0.1 to the compose `db` service unless an external host (e.g. Supabase) is configured.
        if os.path.exists("/.dockerenv"):
            if "@localhost:" in self.DATABASE_URL:
                self.DATABASE_URL = self.DATABASE_URL.replace("@localhost:", "@db:")
            elif "@127.0.0.1:" in self.DATABASE_URL:
                self.DATABASE_URL = self.DATABASE_URL.replace("@127.0.0.1:", "@db:")
        return self


settings = Settings()
