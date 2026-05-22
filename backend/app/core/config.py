from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ================== MINIO / S3 ==================
    MINIO_ENDPOINT: str = "http://localhost:9000"
    # URL для ссылок в браузере (в Docker внутренний host — minio:9000)
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "books"
    MINIO_SECURE: bool = False
    PRESIGNED_URL_EXPIRE_MINUTES: int = 60

    # ================== CORS ==================
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:5500,"
        "http://127.0.0.1:5500,"
        "http://localhost:8080,"
        "http://127.0.0.1:8080,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )

    # ================== JWT ==================
    SECRET_KEY: str = "your-very-long-random-secret-key-min-50-symbols-change-me-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
