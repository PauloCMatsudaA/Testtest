from fastapi import APIRouter, Request, Response, HTTPException
from app.services.whatsapp_service import send_whatsapp_message
from app.services.audio_service import transcribe_audio
from app.services.chat_service import generate_response
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

SPECIAL_COMMANDS = {
    "!limpar": "conversa_limpa",
    "!clear": "conversa_limpa",
    "!ajuda": "ajuda",
    "!help": "ajuda",
}

@router.get("/whatsapp")
async def verify_webhook(request: Request):
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Forbidden")

@router.post("/whatsapp")
async def receive_message(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    entry = body.get("entry", [])
    if not entry:
        return {"status": "no_entry"}

    for e in entry:
        changes = e.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            for msg in messages:
                await _process_message(msg, value)

    return {"status": "ok"}

async def _process_message(msg: dict, value: dict):
    msg_type = msg.get("type")
    from_number = msg.get("from")
    session_id = f"whatsapp_{from_number}"

    if msg_type == "text":
        user_text = msg["text"]["body"].strip()

        if user_text.lower() in SPECIAL_COMMANDS:
            cmd = SPECIAL_COMMANDS[user_text.lower()]
            if cmd == "conversa_limpa":
                from app.services.chat_service import conversation_histories
                if session_id in conversation_histories:
                    del conversation_histories[session_id]
                await send_whatsapp_message(from_number, "Conversa reiniciada! Como posso ajudar?")
                return
            elif cmd == "ajuda":
                help_text = (
                    "*Comandos disponíveis:*\n"
                    "• !limpar ou !clear — Reinicia a conversa\n"
                    "• !ajuda ou !help — Mostra esta mensagem\n\n"
                    "Você também pode me enviar áudios e eu transcreverei para texto!"
                )
                await send_whatsapp_message(from_number, help_text)
                return

        response = await generate_response(user_text, session_id)
        await send_whatsapp_message(from_number, response)

    elif msg_type == "audio":
        audio_id = msg["audio"]["id"]
        try:
            transcribed_text = await transcribe_audio(audio_id)
            if transcribed_text:
                response = await generate_response(transcribed_text, session_id)
                full_response = f'_"{transcribed_text}"_\n\n{response}'
                await send_whatsapp_message(from_number, full_response)
            else:
                await send_whatsapp_message(from_number, "Não consegui transcrever o áudio. Pode enviar em texto?")
        except Exception as e:
            logger.error(f"Audio processing error: {e}")
            await send_whatsapp_message(from_number, "Erro ao processar o áudio. Tente novamente.")

    elif msg_type == "image":
        await send_whatsapp_message(
            from_number,
            "Recebi sua imagem! No momento processo apenas texto e áudio sobre a NR-6."
        )
    else:
        logger.info(f"Unhandled message type: {msg_type}")
