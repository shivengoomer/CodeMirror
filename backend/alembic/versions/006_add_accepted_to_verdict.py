"""Add ACCEPTED to submission_verdict_enum.

Revision ID: 006_add_accepted_to_verdict
Revises: 005_add_ai_analysis
Create Date: 2026-05-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006_add_accepted_to_verdict"
down_revision: str | None = "005_add_ai_analysis"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Use autocommit to avoid "ALTER TYPE ... ADD VALUE cannot run inside a transaction block"
    op.execute("COMMIT")
    op.execute("ALTER TYPE submission_verdict_enum ADD VALUE 'accepted'")


def downgrade() -> None:
    # Removing a value from an enum is not directly supported in Postgres.
    # Typically requires creating a new type, migrating data, and dropping the old type.
    pass
