"""add required_epis to sectors

Revision ID: 001_add_required_epis
Revises:
Create Date: 2026-06-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_add_required_epis'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona coluna required_epis como JSON (lista de EPIs obrigatórios por setor)
    # O valor padrão é uma lista vazia []
    op.add_column(
        'sectors',
        sa.Column('required_epis', sa.JSON(), nullable=False, server_default='[]')
    )


def downgrade() -> None:
    op.drop_column('sectors', 'required_epis')
