from .config import Config

config: Config | None = None


def init_config():
    global config
    config = Config()


def get_config() -> Config:
    return config
