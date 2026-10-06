"""Unavailable ICD-02 transport, distinct from invalid requests."""
class DataFabricUnavailable(RuntimeError):
    """The configured fabric module did not provide a valid response."""
