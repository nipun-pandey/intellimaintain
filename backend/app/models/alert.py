import datetime
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import relationship
from app.database import Base


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True, index=True)
    rule_name = Column(String(255), nullable=False)
    metric = Column(String(100), nullable=False)  # temperature, vibration, pressure, motor_current, anomaly, stale
    condition_type = Column(String(50), nullable=False)  # gt, lt, outside_range, rapid_change, stale
    warning_threshold = Column(Float, nullable=True)
    critical_threshold = Column(Float, nullable=True)
    min_range = Column(Float, nullable=True)
    max_range = Column(Float, nullable=True)
    cooldown_seconds = Column(Integer, default=300, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(100), nullable=False)  # threshold_violation, ml_anomaly, stale_telemetry, rapid_change
    severity = Column(String(50), default="medium", index=True, nullable=False)  # low, medium, high, critical
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    triggering_measurement = Column(JSON, nullable=True)
    detection_reason = Column(Text, nullable=True)
    status = Column(String(50), default="open", index=True, nullable=False)  # open, acknowledged, resolved
    cooldown_key = Column(String(255), nullable=True, index=True)

    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    equipment = relationship("Equipment", back_populates="alerts")

    __table_args__ = (
        Index("idx_alert_status_equipment", "status", "equipment_id"),
        Index("idx_alert_timestamp_desc", "timestamp"),
    )
