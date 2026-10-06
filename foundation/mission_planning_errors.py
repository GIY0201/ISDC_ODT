"""ICD-03 exchange failures shared across runtime and transport."""


class MissionPlanningConflict(RuntimeError):
    """A command no longer matches the accepted module/plan context."""
