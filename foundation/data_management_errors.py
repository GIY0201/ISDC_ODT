"""Shared ICD-01 failure identities across transport and internal contracts."""
class DataManagementUnavailable(RuntimeError):
    """The configured data management endpoint did not answer."""


class DataDeploymentConflict(ValueError):
    """The accepted deployment or execution scope differs from the command's expectation."""
