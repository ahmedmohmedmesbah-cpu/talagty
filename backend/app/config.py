from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./talagty.db"
    allowed_origins: str = "http://localhost:5500,http://127.0.0.1:5500"
    jwt_secret: str = "local-development-secret-change-before-deployment"
    bootstrap_admin_email: str = "admin@talagty.local"
    bootstrap_admin_password: str = "ChangeMe123!"
    jwt_secret: str = "local-development-secret-change-before-deployment"
    bootstrap_admin_email: str = "admin@talagty.local"
    bootstrap_admin_password: str = "ChangeMe123!"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
