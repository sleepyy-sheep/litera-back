from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ================== MINIO / S3 ==================
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "books"
    MINIO_SECURE: bool = False
    PRESIGNED_URL_EXPIRE_MINUTES: int = 60

    # ================== JWT ==================
    SECRET_KEY: str = "your-very-long-random-secret-key-min-50-symbols-change-me-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
