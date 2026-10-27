import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class MeasuredEvidence(BaseModel):
    metric: str
    latest_value: Any
    unit: str
    threshold: Optional[str] = None
    status: str  # Normal, Warning, Critical, Missing
    historical_context: Optional[str] = None


class DiagnosticCheck(BaseModel):
    check_name: str
    subsystem: str  # Mechanical, Electrical, Hydraulic, Thermal, Instrumentation
    procedure: str
    priority: str   # Immediate, High, Medium, Routine


class DiagnosticReport(BaseModel):
    equipment_id: int
    equipment_code: str
    equipment_name: str
    generated_at: datetime.datetime
    engine_used: str  # "Deterministic Rule-Based Expert System" or "Gemini Industrial Diagnostic LLM"
    observations_summary: str
    measured_evidence: List[MeasuredEvidence]
    possible_causes: List[str]
    suggested_checks: List[DiagnosticCheck]
    recommended_actions: List[str]
    uncertainty_and_limitations: str
    risk_level: str  # Low, Moderate, Elevated, Critical
