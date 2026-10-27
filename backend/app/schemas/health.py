import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ContributingFactor(BaseModel):
    factor: str
    impact: str  # negative, neutral, positive
    penalty_points: float
    detail: str


class EquipmentHealthAssessment(BaseModel):
    equipment_id: int
    equipment_code: str
    equipment_name: str
    health_score: float  # 0 to 100
    health_category: str  # Good (85-100), Fair (65-84), Poor (40-64), Critical (0-39), Unknown/Stale
    telemetry_status: str  # Fresh, Stale, Offline, No Data
    latest_telemetry_timestamp: Optional[datetime.datetime] = None
    minutes_since_last_reading: Optional[float] = None
    contributing_factors: List[ContributingFactor]
    active_warning_conditions: List[str]
    assessment_explanation: str
    methodology_note: str = (
        "Heuristic multi-criteria health index based on normalized threshold deviations, "
        "active alarm severities, Isolation Forest anomaly rate, and data freshness. "
        "Not an exact calibrated remaining useful life."
    )
