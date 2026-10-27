import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Core industrial physical measurements
    temperature = Column(Float, nullable=False)  # °C
    vibration = Column(Float, nullable=False)    # mm/s RMS (ISO 10816)
    pressure = Column(Float, nullable=False)     # bar
    motor_current = Column(Float, nullable=False) # Amperes (A)
    speed_rpm = Column(Float, nullable=True)     # Revolutions per minute (RPM)

    sensor_quality = Column(String(50), default="good", nullable=False)  # good, suspect, bad, offline
    metadata_json = Column(JSON, nullable=True)

    # ML Anomaly detection results
    is_anomaly = Column(Boolean, default=False, index=True, nullable=False)
    anomaly_score = Column(Float, nullable=True)  # Raw decision function or normalized isolation forest score

    equipment = relationship("Equipment", back_populates="telemetry_readings")

    __table_args__ = (
        Index("idx_equipment_timestamp", "equipment_id", "timestamp"),
        Index("idx_telemetry_anomaly", "equipment_id", "is_anomaly"),
    )
