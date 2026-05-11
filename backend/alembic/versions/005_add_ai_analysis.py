"""add ai_analysis to submissions

Revision ID: 005_add_ai_analysis
Revises: 004_leetcode_sessions
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_add_ai_analysis"
down_revision: str | None = "004_leetcode_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("ai_analysis", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "ai_analysis")
