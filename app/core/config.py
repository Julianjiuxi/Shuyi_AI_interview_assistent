from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    # 实时访谈链路使用更快、更便宜的 Flash；传记写作等重型任务仍用 Pro。
    deepseek_interview_model: str = "deepseek-v4-flash"
    database_url: str = "sqlite:///./shuyi.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
