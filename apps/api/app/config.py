from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    supabase_url: str = ""
    supabase_db_url: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": "../../.env", "extra": "ignore"}


settings = Settings()
