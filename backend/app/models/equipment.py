import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    equipment_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    equipment_type = Column(String(100), index=True, nullable=False)  # pump, compressor, motor, fan, hydraulic_press
    location = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    operational_status = Column(String(50), default="operational", index=True, nullable=False)  # operational, warning, critical, maintenance, offline
    installation_date = Column(DateTime, nullable=True)
    sensor_thresholds = Column(JSON, nullable=True)  # custom or default limits
    is_archived = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Relationships
    telemetry_readings = relationship("Telemetry", back_populates="equipment", cascade="all, delete-orphan", lazy="dynamic")
    alerts = relationship("Alert", back_populates="equipment", cascade="all, delete-orphan", lazy="dynamic")
    maintenance_records = relationship("MaintenanceRecord", back_populates="equipment", cascade="all, delete-orphan", lazy="dynamic")
