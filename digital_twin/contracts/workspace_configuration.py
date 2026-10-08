class ConfigurationConflict(Exception):
    """Persisted definition revision changed."""

class ConfigurationUnavailable(Exception):
    """No durable storage available; do not silently substitute memory."""
