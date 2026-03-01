from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Config(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    google_client_id: str = ""
    google_client_secret: str = ""
    secret_key: str = "dev-secret-key-change-in-production"
    redirect_url_after_auth_base: str = ""
    redirect_url_during_auth_base: str = ""
    algorithm: str = "HS256"
