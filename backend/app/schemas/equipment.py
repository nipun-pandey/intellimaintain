import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SensorThresholds(BaseModel):
    temp_warn: float = 75.0
    temp_crit: float = 90.0
    vib_warn: float = 4.5
    vib_crit: float = 7.1
    press_min: float = 1.5
    press_max: float = 6.0
    current_max: float = 35.0
    rpm_min: Optional[float] = None
    rpm_max: Optional[float] = None


class EquipmentBase(BaseModel):
    equipment_code: str = Field(..., example="PUMP-101")
    name: str = Field(..., example="Primary Cooling Water Pump")
    equipment_type: str = Field(..., example="pump")  # pump, compressor, motor, fan, hydraulic_press, turbine
    location: str = Field(..., example="Building B - Sector 4")
    description: Optional[str] = None
    operational_status: str = "operational"  # operational, warning, critical, maintenance, offline
    installation_date: Optional[datetime.datetime] = None
    sensor_thresholds: Optional[Dict[str, Any]] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    equipment_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    operational_status: Optional[str] = None
    installation_date: Optional[datetime.datetime] = None
    sensor_thresholds: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None


class EquipmentResponse(EquipmentBase):
    id: int
    is_archived: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    active_alerts_count: Optional[int] = 0
    health_score: Optional[float] = None
    health_category: Optional[str] = None
    latest_telemetry_timestamp: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True
