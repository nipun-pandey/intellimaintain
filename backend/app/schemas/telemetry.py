import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class TelemetryBase(BaseModel):
    equipment_id: int
    timestamp: Optional[datetime.datetime] = None
    temperature: float = Field(..., description="Temperature in degrees Celsius (°C)")
    vibration: float = Field(..., description="Vibration velocity in mm/s RMS (ISO 10816)")
    pressure: float = Field(..., description="Operating pressure in bar")
    motor_current: float = Field(..., description="Motor current in Amperes (A)")
    speed_rpm: Optional[float] = Field(None, description="Rotational speed in RPM")
    sensor_quality: str = Field("good", description="Sensor signal quality: good, suspect, bad, offline")
    metadata_json: Optional[Dict[str, Any]] = None

    @field_validator("temperature")
    @classmethod
    def validate_temp(cls, v: float) -> float:
        if v < -50 or v > 350:
            raise ValueError("Temperature must be within plausible range [-50°C, 350°C]")
        return round(v, 2)

    @field_validator("vibration")
    @classmethod
    def validate_vib(cls, v: float) -> float:
        if v < 0 or v > 150:
            raise ValueError("Vibration must be within plausible range [0, 150 mm/s RMS]")
        return round(v, 3)

    @field_validator("pressure")
    @classmethod
    def validate_press(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("Pressure must be within plausible range [0, 100 bar]")
        return round(v, 2)

    @field_validator("motor_current")
    @classmethod
    def validate_current(cls, v: float) -> float:
        if v < 0 or v > 1000:
            raise ValueError("Motor current must be within plausible range [0, 1000 A]")
        return round(v, 2)


class TelemetryCreate(TelemetryBase):
    pass


class TelemetryBatchCreate(BaseModel):
    readings: List[TelemetryCreate]


class TelemetryResponse(TelemetryBase):
    id: int
    timestamp: datetime.datetime
    is_anomaly: bool
    anomaly_score: Optional[float] = None

    class Config:
        from_attributes = True


class TelemetryAggregatedPoint(BaseModel):
    bucket_time: str
    avg_temperature: float
    max_temperature: float
    avg_vibration: float
    max_vibration: float
    avg_pressure: float
    avg_current: float
    reading_count: int
    anomaly_count: int


class TelemetryAggregateResponse(BaseModel):
    equipment_id: int
    period: str
    points: List[TelemetryAggregatedPoint]
