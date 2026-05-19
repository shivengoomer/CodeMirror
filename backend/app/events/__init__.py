"""Event type constants for the event bus."""

# Submission events
SUBMISSION_CREATED = "submission.created"
SUBMISSION_UPDATED = "submission.updated"

# Analysis events
ANALYSIS_STARTED = "analysis.started"
ANALYSIS_COMPLETED = "analysis.completed"
ANALYSIS_FAILED = "analysis.failed"

# Pattern events
PATTERN_DETECTED = "pattern.detected"
PATTERN_RESOLVED = "pattern.resolved"

# Sync events
SYNC_STARTED = "sync.started"
SYNC_COMPLETED = "sync.completed"
SYNC_FAILED = "sync.failed"

# Revision events
REVISION_QUEUE_UPDATED = "revision.queue_updated"
ROADMAP_UPDATED = "roadmap.updated"

# Analytics events
STATISTICS_UPDATED = "statistics.updated"
REPORT_GENERATED = "report.generated"
HEATMAP_UPDATED = "heatmap.updated"
