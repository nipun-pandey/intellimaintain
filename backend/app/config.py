from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "IntelliMaintain"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "intellimaintain-super-secret-jwt-key-2024-secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./intellimaintain.db")

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:3000",
    ]

    # Optional Gemini / LLM API key for enhanced diagnostic narratives
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Telemetry threshold defaults
    DEFAULT_TEMP_WARN_C: float = 75.0
    DEFAULT_TEMP_CRIT_C: float = 90.0
    DEFAULT_VIB_WARN_MMS: float = 4.5  # mm/s RMS (ISO 10816 class standard)
    DEFAULT_VIB_CRIT_MMS: float = 7.1
    DEFAULT_PRESS_MIN_BAR: float = 1.5
    DEFAULT_PRESS_MAX_BAR: float = 6.0
    DEFAULT_CURRENT_MAX_A: float = 35.0

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
