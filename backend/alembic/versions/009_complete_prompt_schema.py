"""complete prompt schema gaps

Revision ID: 009_complete_prompt_schema
Revises: 008_v2_architecture
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_complete_prompt_schema"
down_revision = "008_v2_architecture"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("last_login", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "auth_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("encrypted_session_token", sa.Text(), nullable=False),
        sa.Column("csrf_token", sa.Text(), nullable=True),
        sa.Column("browser_fingerprint", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_refreshed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
    )

    op.create_table(
        "jwt_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.create_table(
        "ast_metadata",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("ast_tree", postgresql.JSONB(), nullable=True),
        sa.Column("function_count", sa.Integer(), nullable=True),
        sa.Column("class_count", sa.Integer(), nullable=True),
        sa.Column("loop_count", sa.Integer(), nullable=True),
        sa.Column("conditional_count", sa.Integer(), nullable=True),
        sa.Column("recursion_depth", sa.Integer(), nullable=True),
        sa.Column("linter_errors", postgresql.JSONB(), nullable=True),
        sa.Column("linter_warnings", postgresql.JSONB(), nullable=True),
        sa.Column("code_quality_score", sa.Float(), nullable=True),
        sa.Column("lines_of_code", sa.Integer(), nullable=True),
        sa.Column("cyclomatic_complexity", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "topic_analytics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.String(100), nullable=False),
        sa.Column("analysis_date", sa.Date(), nullable=False),
        sa.Column("problems_attempted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("problems_solved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accuracy_rate", sa.Float(), nullable=True),
        sa.Column("average_attempts", sa.Float(), nullable=True),
        sa.Column("total_time_spent_minutes", sa.Integer(), nullable=True),
        sa.Column("average_time_per_problem", sa.Float(), nullable=True),
        sa.Column("easy_accuracy", sa.Float(), nullable=True),
        sa.Column("medium_accuracy", sa.Float(), nullable=True),
        sa.Column("hard_accuracy", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "topic", "analysis_date", name="uq_topic_analytics_user_topic_date"),
    )
    op.create_index("idx_topic_analytics_user", "topic_analytics", ["user_id", "topic", "analysis_date"])

    op.create_table(
        "complexity_progression",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("attempt_number", sa.Integer(), nullable=True),
        sa.Column("time_complexity", sa.String(50), nullable=True),
        sa.Column("space_complexity", sa.String(50), nullable=True),
        sa.Column("is_optimal", sa.Boolean(), nullable=True),
        sa.Column("code_quality_score", sa.Float(), nullable=True),
        sa.Column("uses_best_approach", sa.Boolean(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_complexity_user_question", "complexity_progression", ["user_id", "question_id", "attempt_number"])

    op.create_table(
        "code_evolution",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("submissions.id"), nullable=True),
        sa.Column("stage", sa.String(50), nullable=True),
        sa.Column("improvements_made", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "question_id", "version_number", name="uq_code_evolution_version"),
    )


def downgrade() -> None:
    op.drop_table("code_evolution")
    op.drop_index("idx_complexity_user_question", table_name="complexity_progression")
    op.drop_table("complexity_progression")
    op.drop_index("idx_topic_analytics_user", table_name="topic_analytics")
    op.drop_table("topic_analytics")
    op.drop_table("ast_metadata")
    op.drop_table("jwt_tokens")
    op.drop_table("auth_tokens")
    op.drop_column("users", "last_login")
    op.drop_column("users", "is_active")
