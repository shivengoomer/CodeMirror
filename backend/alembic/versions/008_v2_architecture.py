"""v2 architecture: add all new tables for modular services

Revision ID: 008_v2_architecture
Revises: 7d9d49e83db0
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_v2_architecture"
down_revision = "7d9d49e83db0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── sync_state ─────────────────────────────────────────────────
    op.create_table(
        "sync_state",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("total_submissions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sync_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("last_sync_error", sa.Text),
        sa.Column("next_retry_at", sa.DateTime(timezone=True)),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── sync_jobs ──────────────────────────────────────────────────
    op.create_table(
        "sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("submissions_fetched", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── events ─────────────────────────────────────────────────────
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_events_type", "events", ["event_type"])
    op.create_index("idx_events_created_at", "events", ["created_at"])
    op.create_index("idx_events_entity", "events", ["entity_type", "entity_id"])

    # ── celery_tasks ───────────────────────────────────────────────
    op.create_table(
        "celery_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", sa.String(255), unique=True, nullable=False),
        sa.Column("task_name", sa.String(255), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("args", postgresql.JSONB),
        sa.Column("kwargs", postgresql.JSONB),
        sa.Column("result", postgresql.JSONB),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("idx_celery_tasks_status", "celery_tasks", ["status"])
    op.create_index("idx_celery_tasks_created_at", "celery_tasks", ["created_at"])

    # ── ai_analysis ────────────────────────────────────────────────
    op.create_table(
        "ai_analysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("logical_mistakes", postgresql.JSONB),
        sa.Column("pattern_mistakes", postgresql.JSONB),
        sa.Column("syntax_issues", postgresql.JSONB),
        sa.Column("edge_cases_missed", postgresql.JSONB),
        sa.Column("time_complexity", sa.String(50)),
        sa.Column("space_complexity", sa.String(50)),
        sa.Column("complexity_explanation", sa.Text),
        sa.Column("better_approach", sa.Text),
        sa.Column("refactored_code", sa.Text),
        sa.Column("optimization_suggestions", postgresql.JSONB),
        sa.Column("confidence_score", sa.Float),
        sa.Column("analysis_version", sa.String(20)),
        sa.Column("processing_time_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_ai_analysis_submission", "ai_analysis", ["submission_id"])
    op.create_index("idx_ai_analysis_user", "ai_analysis", ["user_id"])

    # ── pattern_detection ──────────────────────────────────────────
    op.create_table(
        "pattern_detection",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pattern_type", sa.String(100), nullable=False),
        sa.Column("pattern_category", sa.String(50)),
        sa.Column("occurrences", sa.Integer, nullable=False, server_default="1"),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("example_submission_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True))),
        sa.Column("severity", sa.String(20)),
        sa.Column("description", sa.Text),
        sa.Column("suggestions", postgresql.JSONB),
        sa.Column("is_resolved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_pattern_detection_user", "pattern_detection", ["user_id"])
    op.create_index("idx_pattern_detection_type", "pattern_detection", ["pattern_type"])

    # ── topic_strength ─────────────────────────────────────────────
    op.create_table(
        "topic_strength",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.String(100), nullable=False),
        sa.Column("strength_score", sa.Float),
        sa.Column("total_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("successful_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("average_retries", sa.Float),
        sa.Column("average_time_seconds", sa.Float),
        sa.Column("last_practiced_at", sa.DateTime(timezone=True)),
        sa.Column("days_since_practice", sa.Integer),
        sa.Column("avoidance_score", sa.Float),
        sa.Column("confidence_score", sa.Float),
        sa.Column("score_trend", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "topic", name="uq_topic_strength_user_topic"),
    )
    op.create_index("idx_topic_strength_user", "topic_strength", ["user_id"])
    op.create_index("idx_topic_strength_score", "topic_strength", ["strength_score"])

    # ── learning_style ─────────────────────────────────────────────
    op.create_table(
        "learning_style",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("rushing_score", sa.Float),
        sa.Column("pattern_copying_score", sa.Float),
        sa.Column("debugging_strength", sa.Float),
        sa.Column("optimization_thinking", sa.Float),
        sa.Column("consistency_score", sa.Float),
        sa.Column("average_session_length_min", sa.Integer),
        sa.Column("average_problems_per_session", sa.Float),
        sa.Column("preferred_difficulty", sa.String(20)),
        sa.Column("preferred_topics", postgresql.ARRAY(sa.String)),
        sa.Column("learns_from_mistakes", sa.Boolean),
        sa.Column("revisits_problems", sa.Boolean),
        sa.Column("uses_hints", sa.Boolean),
        sa.Column("analysis_summary", sa.Text),
        sa.Column("recommendations", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── roadmaps ───────────────────────────────────────────────────
    op.create_table(
        "roadmaps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("goal", sa.String(255)),
        sa.Column("timeline_weeks", sa.Integer),
        sa.Column("target_company", sa.String(100)),
        sa.Column("target_role", sa.String(100)),
        sa.Column("weekly_plan", postgresql.JSONB),
        sa.Column("milestones", postgresql.JSONB),
        sa.Column("current_week", sa.Integer, nullable=False, server_default="1"),
        sa.Column("completion_percentage", sa.Float, nullable=False, server_default="0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )

    # ── roadmap_progress ───────────────────────────────────────────
    op.create_table(
        "roadmap_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("roadmap_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_number", sa.Integer),
        sa.Column("planned_topics", postgresql.ARRAY(sa.String)),
        sa.Column("completed_topics", postgresql.ARRAY(sa.String)),
        sa.Column("planned_problems", sa.Integer),
        sa.Column("completed_problems", sa.Integer),
        sa.Column("week_start_date", sa.Date),
        sa.Column("week_end_date", sa.Date),
        sa.Column("status", sa.String(50)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── interview_readiness ────────────────────────────────────────
    op.create_table(
        "interview_readiness",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("overall_score", sa.Float),
        sa.Column("easy_problems_score", sa.Float),
        sa.Column("medium_problems_score", sa.Float),
        sa.Column("hard_problems_score", sa.Float),
        sa.Column("target_company", sa.String(100)),
        sa.Column("company_readiness_score", sa.Float),
        sa.Column("topics_covered", postgresql.ARRAY(sa.String)),
        sa.Column("topics_weak", postgresql.ARRAY(sa.String)),
        sa.Column("topics_strong", postgresql.ARRAY(sa.String)),
        sa.Column("recommended_focus", postgresql.JSONB),
        sa.Column("estimated_days_to_ready", sa.Integer),
        sa.Column("last_assessed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── user_statistics ────────────────────────────────────────────
    op.create_table(
        "user_statistics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_type", sa.String(20), nullable=False),
        sa.Column("period_date", sa.Date, nullable=False),
        sa.Column("total_submissions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("accepted_submissions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed_submissions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("acceptance_rate", sa.Float),
        sa.Column("easy_solved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("medium_solved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("hard_solved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_streak_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("longest_streak_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_coding_time_minutes", sa.Integer),
        sa.Column("average_problem_time_minutes", sa.Float),
        sa.Column("score_change", sa.Float),
        sa.Column("rank_change", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "period_type", "period_date", name="uq_user_stats"),
    )
    op.create_index("idx_stats_user_period", "user_statistics", ["user_id", "period_type", "period_date"])

    # ── daily_intelligence_reports ─────────────────────────────────
    op.create_table(
        "daily_intelligence_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_date", sa.Date, nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("achievements", postgresql.JSONB),
        sa.Column("areas_of_concern", postgresql.JSONB),
        sa.Column("recommendations", postgresql.JSONB),
        sa.Column("problems_solved_today", sa.Integer),
        sa.Column("accuracy_today", sa.Float),
        sa.Column("overall_progress_score", sa.Float),
        sa.Column("topic_improvements", postgresql.JSONB),
        sa.Column("topic_declines", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "report_date", name="uq_daily_report"),
    )
    op.create_index("idx_reports_user_date", "daily_intelligence_reports", ["user_id", "report_date"])

    # ── heatmap_data ───────────────────────────────────────────────
    op.create_table(
        "heatmap_data",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("heatmap_type", sa.String(50), nullable=False),
        sa.Column("data", postgresql.JSONB),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "heatmap_type", name="uq_heatmap"),
    )


def downgrade() -> None:
    op.drop_table("heatmap_data")
    op.drop_table("daily_intelligence_reports")
    op.drop_table("user_statistics")
    op.drop_table("interview_readiness")
    op.drop_table("roadmap_progress")
    op.drop_table("roadmaps")
    op.drop_table("learning_style")
    op.drop_table("topic_strength")
    op.drop_table("pattern_detection")
    op.drop_table("ai_analysis")
    op.drop_table("celery_tasks")
    op.drop_table("events")
    op.drop_table("sync_jobs")
    op.drop_table("sync_state")
