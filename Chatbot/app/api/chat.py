from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chat_service import generate_response

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    session_id: str

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    response = await generate_response(request.message, request.session_id)
    return ChatResponse(response=response, session_id=request.session_id)

@router.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    from app.services.chat_service import conversation_histories
    if session_id in conversation_histories:
        del conversation_histories[session_id]
    return {"message": f"Session {session_id} cleared"}
