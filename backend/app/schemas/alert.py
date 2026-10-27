import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class AlertBase(BaseModel):
    equipment_id: int
    alert_type: str  # threshold_violation, ml_anomaly, stale_telemetry, rapid_change
    severity: str    # low, medium, high, critical
    title: str
    description: str
    triggering_measurement: Optional[Dict[str, Any]] = None
    detection_reason: Optional[str] = None


class AlertCreate(AlertBase):
    cooldown_key: Optional[str] = None


class AlertAcknowledge(BaseModel):
    acknowledged_by: Optional[str] = None


class AlertResolve(BaseModel):
    resolved_by: Optional[str] = None
    resolution_notes: str


class AlertResponse(AlertBase):
    id: int
    status: str  # open, acknowledged, resolved
    timestamp: datetime.datetime
    acknowledged_at: Optional[datetime.datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime.datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    cooldown_key: Optional[str] = None

    class Config:
        from_attributes = True


class AlertRuleBase(BaseModel):
    equipment_id: Optional[int] = None
    rule_name: str
    metric: str
    condition_type: str
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    min_range: Optional[float] = None
    max_range: Optional[float] = None
    cooldown_seconds: int = 300
    is_enabled: bool = True


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRuleResponse(AlertRuleBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True
