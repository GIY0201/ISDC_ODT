from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class DataProduct(BaseModel):
    """ICD-01 product record: one data item a node registers with the data center."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    ref: str = Field(min_length=1, max_length=120)
    class_: str = Field(alias="class", min_length=1, max_length=40)
    source: str = Field(min_length=1, max_length=80)
    size_mb: float = Field(ge=0, le=1e7)
    priority: int = Field(default=1, ge=0, le=9)
    label: str | None = Field(default=None, max_length=120)
    created_s: float | None = Field(default=None, ge=0)


class DataIngestMessage(BaseModel):
    """DM-01 수집 등록 (digital twin → data management)."""

    model_config = ConfigDict(extra="allow")
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    time: str = Field(min_length=1, max_length=40)
    sim_elapsed_s: float = Field(ge=0)
    products: list[DataProduct] = Field(max_length=2000)


class DataServiceRequest(BaseModel):
    """DM-02 서비스 요청."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    time: str = Field(min_length=1, max_length=40)
    sim_elapsed_s: float = Field(ge=0)
    object_id: str | None = Field(default=None, max_length=80)
    class_: str | None = Field(default=None, alias="class", max_length=40)
    destination: str = Field(min_length=1, max_length=80)
    requester: str = Field(default="operator", max_length=80)


class DataActionRequest(BaseModel):
    """DM-03 운영 조치."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    time: str = Field(min_length=1, max_length=40)
    sim_elapsed_s: float = Field(ge=0)
    action: Literal["verify", "heal", "rebalance", "set_replication", "set_filter", "purge_expired"]
    object_id: str | None = Field(default=None, max_length=80)
    class_: str | None = Field(default=None, alias="class", max_length=40)
    replication: int | None = Field(default=None, ge=1, le=5)
    filter: dict | None = None


class StorageNodeRecord(BaseModel):
    """DM-04 storage node record with the availability the twin observed."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=80)
    kind: Literal["core", "edge", "onboard"]
    capacity_gb: float = Field(ge=0, le=1e9)
    available: bool = True
    reason: str | None = Field(default=None, max_length=120)


class StorageTopology(BaseModel):
    """DM-04 저장 노드 상태 갱신 (digital twin → data management)."""

    model_config = ConfigDict(extra="allow")
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    time: str = Field(min_length=1, max_length=40)
    sim_elapsed_s: float = Field(ge=0)
    nodes: list[StorageNodeRecord] = Field(max_length=500)


class ConsoleServiceRequest(BaseModel):
    """Operator request from the console; the twin stamps the ICD time fields."""

    model_config = ConfigDict(populate_by_name=True)
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    object_id: str | None = Field(default=None, max_length=80)
    class_: str | None = Field(default=None, alias="class", max_length=40)
    destination: str = Field(min_length=1, max_length=80)


class ConsoleActionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    scope_id: str | None = Field(default=None, min_length=1, max_length=240)

    action: Literal["verify", "heal", "rebalance", "set_replication", "set_filter", "purge_expired"]
    object_id: str | None = Field(default=None, max_length=80)
    class_: str | None = Field(default=None, alias="class", max_length=40)
    replication: int | None = Field(default=None, ge=1, le=5)
    filter: dict | None = None


