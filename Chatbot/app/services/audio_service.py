import httpx
from app.core.config import settings
from openai import AsyncOpenAI
import tempfile
import os

async_openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def _download_audio(audio_id: str) -> bytes:
    url = f"https://graph.facebook.com/v18.0/{audio_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        media_info = response.json()
        media_url = media_info.get("url")

        audio_response = await client.get(media_url, headers=headers)
        audio_response.raise_for_status()
        return audio_response.content

async def transcribe_audio(audio_id: str) -> str:
    audio_bytes = await _download_audio(audio_id)

    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp_file:
        tmp_file.write(audio_bytes)
        tmp_path = tmp_file.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcript = await async_openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="pt"
            )
        return transcript.text
    finally:
        os.unlink(tmp_path)
