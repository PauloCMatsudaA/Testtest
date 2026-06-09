from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# EPIs válidos para seleção nos setores
EPI_CHOICES = [
    "Capacete",
    "Luvas",
    "Óculos de segurança",
    "Colete refletivo",
    "Botina de segurança",
    "Protetor auricular",
    "Máscara respiratória",
    "Avental de proteção",
    "Cinto de segurança",
    "Mangote",
]


class SectorBase(BaseModel):
    name: str
    description: Optional[str] = None
    required_epis: List[str] = Field(
        default_factory=list,
        description="Lista de EPIs essenciais obrigatórios para detecção neste setor.",
        examples=[["Capacete", "Luvas", "Botina de segurança"]],
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
