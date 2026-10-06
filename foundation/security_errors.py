"""Shared ICD-08 failure identity across transport and internal contracts."""
class SecurityUnavailable(RuntimeError):
    """The configured security module failed or returned an incompatible response."""


