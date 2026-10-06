"""Original ICD-02 wire fields, bounds and engineering units."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class NetworkNode(BaseModel):
    """ICD-02 node record: a satellite the twin propagates or a ground station it models."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=80)
    kind: Literal["satellite", "ground"]
    name: str | None = Field(default=None, max_length=80)
    mode: str | None = Field(default=None, max_length=40)
    generation_mbps: float = Field(default=0.0, ge=0, le=100000)
    storage_gb: float = Field(default=0.0, ge=0, le=1e6)
    extra_delay_ms: float = Field(default=0.0, ge=0, le=100000)


class NetworkLink(BaseModel):
    """ICD-02 link record with the geometry and terminal state the twin observed."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=160)
    a: str = Field(min_length=1, max_length=80)
    b: str = Field(min_length=1, max_length=80)
    kind: Literal["oisl", "ground", "terrestrial"]
    state: str | None = Field(default=None, max_length=40)
    faulted: bool = False


class NetworkSnapshot(BaseModel):
    """네트워크 상태 갱신 (digital twin → data fabric)."""

    model_config = ConfigDict(extra="allow")

    time: str = Field(min_length=1, max_length=40)
    nodes: list[NetworkNode] = Field(max_length=2000)
    links: list[NetworkLink] = Field(max_length=20000)


class FabricRouteRequest(BaseModel):
    source: str = Field(min_length=1, max_length=80)
    target: str = Field(min_length=1, max_length=80)
    objective: Literal["latency", "reliability", "balanced"] = "balanced"
