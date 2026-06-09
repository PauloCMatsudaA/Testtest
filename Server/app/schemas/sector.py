from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# Classes de detecção YOLO disponíveis no modelo best.pt
# Esses são os nomes EXATOS que devem ser usados em required_epis
YOLO_EPI_CLASSES = [
    "helmet",            # Capacete
    "gloves",            # Luvas
    "glasses",           # Óculos de segurança
    "safety-vest",       # Colete de segurança
    "earmuffs",          # Protetor auricular
    "face-mask-medical", # Máscara cirúrgica
    "face-guard",        # Protetor facial
    "medical-suit",      # Macacão médico
    "safety-suit",       # Macacão de segurança
]


class SectorBase(BaseModel):
    name: str
    description: Optional[str] = None
    required_epis: List[str] = Field(
        default_factory=list,
        description=(
            "Lista de EPIs obrigatórios para detecção neste setor. "
            "Use os nomes de classe YOLO: helmet, gloves, glasses, "
            "safety-vest, earmuffs, face-mask-medical, face-guard, "
            "medical-suit, safety-suit."
        ),
        examples=[["helmet", "gloves", "safety-vest"]],
    )


class SectorCreate(SectorBase):
    pass


class SectorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    required_epis: Optional[List[str]] = None


class SectorResponse(SectorBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
