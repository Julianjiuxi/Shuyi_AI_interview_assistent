from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    # 实时访谈链路使用更快、更便宜的 Flash；传记写作等重型任务仍用 Pro。
    deepseek_interview_model: str = "deepseek-v4-flash"
    database_url: str = "sqlite:///./shuyi.db"

    # MiniMax 媒体生成（key 留空，由前端同学提供并测试）
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.io"
    minimax_image_model: str = "image-01"
    minimax_speech_model: str = "speech-2.8-hd"
    minimax_video_model: str = "MiniMax-H3"

    # 存储与公开地址
    media_storage_dir: str = "./uploads"
    public_base_url: str = "http://127.0.0.1:8000"

    # CORS（逗号分隔的允许来源列表）。开发期覆盖 Vinext/Vite 常见端口，上线前收紧为正式域名。
    allowed_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )

    # 破坏性接口开关（生产环境应关闭）
    enable_destructive_endpoints: bool = False

    # 媒体生成 Mock 模式：无 key 时联调用，跳过真实 MiniMax 调用
    enable_mock_media: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
