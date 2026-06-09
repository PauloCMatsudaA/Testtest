from fastapi import APIRouter, Depends, File, UploadFile, Form
from fastapi.responses import JSONResponse
from typing import Optional

from app.core.deps import get_current_user
from app.models.user import User
from app.services.detection_service_real import analyze_frame


router = APIRouter(prefix="/detection", tags=["Detection"])


@router.post("/analyze-frame")
async def analyze_frame_endpoint(
    camera_id: int = Form(...),
    frame: UploadFile = File(...),
    sector_id: Optional[int] = Form(None),
    _: User = Depends(get_current_user),
):
    """
    Analisa um frame e retorna se a pessoa está conforme.
    Passe sector_id para usar os EPIs obrigatórios do setor específico.
    Sem sector_id usa o padrão (helmet).
    """
    frame_data = await frame.read()
    result = await analyze_frame(camera_id=camera_id, frame_data=frame_data, sector_id=sector_id)
    return JSONResponse(content=result)
