from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""

    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "episee_verify_token"

    CHATBOT_MODEL: str = "gpt-4o-mini"
    CHATBOT_MAX_TOKENS: int = 1024
    CHATBOT_TEMPERATURE: float = 0.3

    RAG_INDEX_PATH: str = "data/nr6_faiss"
    RAG_CHUNKS_PATH: str = "data/nr6_chunks"
    RAG_TOP_K: int = 5

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
