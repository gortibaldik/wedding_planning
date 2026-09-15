from pydantic import ConfigDict, Field, model_validator
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    google_client_id: str = ""
    google_client_secret: str = ""
    secret_key: str = "dev-secret-key-change-in-production"  # noqa: S105
    redirect_url_after_auth_base: str = ""
    redirect_url_during_auth_base: str = ""
    algorithm: str = "HS256"
    enable_local_auth: bool = False
    token_expiration_hours: int = 6
    rediscloud_url: str = ""

    allowed_users: list[str] = Field(default_factory=lambda: ["ferotre@gmail.com"])
    super_users: list[str] = Field(default_factory=lambda: ["ferotre@gmail.com"])

    managed_files_dump_users: list[str] = Field(
        default_factory=lambda: ["ferotre@gmail.com"]
    )
    """Emails of users allowed to download the full Redis data dump."""

    finance_tracking: list[str] = Field(default_factory=lambda: ["ferotre@gmail.com"])
    """Emails of users allowed to access the home finance tracking data."""

    documents_editors: list[str] = Field(default_factory=lambda: ["ferotre@gmail.com"])
    """Emails of users allowed to edit the document links and their sections."""

    documents_viewers: list[str] | None = None
    """Emails of users allowed to see the Wedding Organization tab at all.

    Defaults to :attr:`documents_editors` when left unset; editors can always
    view, so they don't have to be repeated here.
    """

    google_application_credentials_json: str = ""
    google_drive_i18n_folder_id: str = ""

    @model_validator(mode="after")
    def _default_documents_viewers(self) -> "Config":
        if self.documents_viewers is None:
            self.documents_viewers = list(self.documents_editors)
        return self
