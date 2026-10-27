from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SimulatorConfig(BaseModel):
    equipment_id: int
    scenario: str = Field(..., description="normal, deterioration, anomaly, sensor_failure, communication_interruption")
    interval_seconds: float = Field(2.0, ge=0.5, le=30.0, description="Telemetry generation interval in seconds")


class SimulatorStatus(BaseModel):
    is_running: bool
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    scenario: Optional[str] = None
    interval_seconds: float = 2.0
    readings_generated: int = 0
    current_step: int = 0
    last_reading_time: Optional[str] = None
    status_message: str = "Idle"
