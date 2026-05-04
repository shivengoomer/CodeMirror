"""Initial database schema.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-05-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


platform_enum = postgresql.ENUM("leetcode", "gfg", "hackerrank", name="platform_enum", create_type=False)
submission_verdict_enum = postgresql.ENUM(
    "wrong_answer",
    "tle",
    "mle",
    "runtime_error",
    "compile_error",
    name="submission_verdict_enum",
    create_type=False,
)
pattern_impact_enum = postgresql.ENUM("low", "medium", "high", "critical", name="pattern_impact_enum", create_type=False)
submission_tag_role_enum = postgresql.ENUM("primary", "contributing", name="submission_tag_role_enum", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
    platform_enum.create(bind, checkfirst=True)
    submission_verdict_enum.create(bind, checkfirst=True)
    pattern_impact_enum.create(bind, checkfirst=True)
    submission_tag_role_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("leetcode_username", sa.String(length=100), nullable=True),
        sa.Column("gfg_username", sa.String(length=100), nullable=True),
        sa.Column("hackerrank_username", sa.String(length=100), nullable=True),
        sa.Column("timezone", sa.String(length=50), server_default="UTC", nullable=False),
        sa.Column("available_minutes_per_day", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_active", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "patterns",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("insight", sa.Text(), nullable=False),
        sa.Column("concept_cluster", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("impact", pattern_impact_enum, nullable=False),
        sa.Column("suggested_revision_interval_days", sa.Integer(), server_default="7", nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_patterns_user_impact", "patterns", ["user_id", "impact"])

    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("problem_slug", sa.String(length=200), nullable=False),
        sa.Column("problem_title", sa.String(length=300), nullable=False),
        sa.Column("language", sa.String(length=50), nullable=False),
        sa.Column("code_snapshot", sa.Text(), nullable=False),
        sa.Column("verdict", submission_verdict_enum, nullable=False),
        sa.Column("failing_test_cases", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("runtime_ms", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("analysed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_submissions_user_platform", "submissions", ["user_id", "platform"])
    op.create_index(
        "idx_submissions_user_analysed",
        "submissions",
        ["user_id", "analysed"],
        postgresql_where=sa.text("analysed = false"),
    )

    op.create_table(
        "submission_tags",
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pattern_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", submission_tag_role_enum, nullable=False),
        sa.ForeignKeyConstraint(["pattern_id"], ["patterns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("submission_id", "pattern_id"),
    )

    op.create_table(
        "revision_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_slug", sa.String(length=200), nullable=False),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("problem_title", sa.String(length=300), nullable=False),
        sa.Column("linked_pattern_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("interval_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("ease_factor", sa.Float(), server_default="2.5", nullable=False),
        sa.Column("repetitions", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_due", sa.Date(), nullable=False),
        sa.Column("last_reviewed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verdict", sa.String(length=50), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["linked_pattern_id"], ["patterns.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "problem_slug", "platform", name="uq_revision_queue_user_problem_platform"),
    )
    op.create_index("idx_revision_queue_due", "revision_queue", ["user_id", "next_due"])

    op.create_table(
        "weekly_digests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("digest_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("weekly_digests")
    op.drop_index("idx_revision_queue_due", table_name="revision_queue")
    op.drop_table("revision_queue")
    op.drop_table("submission_tags")
    op.drop_index("idx_submissions_user_analysed", table_name="submissions")
    op.drop_index("idx_submissions_user_platform", table_name="submissions")
    op.drop_table("submissions")
    op.drop_index("idx_patterns_user_impact", table_name="patterns")
    op.drop_table("patterns")
    op.drop_table("users")

    bind = op.get_bind()
    submission_tag_role_enum.drop(bind, checkfirst=True)
    pattern_impact_enum.drop(bind, checkfirst=True)
    submission_verdict_enum.drop(bind, checkfirst=True)
    platform_enum.drop(bind, checkfirst=True)
