import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

WHATSAPP_API_URL = "https://graph.facebook.com/v18.0"

async def send_whatsapp_message(to: str, message: str) -> bool:
    url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message}
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            logger.info(f"Message sent to {to}")
            return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to send message to {to}: {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending message: {e}")
            return False
