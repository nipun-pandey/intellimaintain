import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from app.database import Base


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    maintenance_type = Column(String(50), default="preventive", nullable=False)  # preventive, corrective, inspection, emergency, calibration
    priority = Column(String(50), default="medium", nullable=False)  # low, medium, high, critical
    status = Column(String(50), default="scheduled", index=True, nullable=False)  # scheduled, in_progress, completed, cancelled
    scheduled_date = Column(DateTime, nullable=False, index=True)
    completion_date = Column(DateTime, nullable=True)
    assigned_technician = Column(String(255), nullable=True)
    work_performed = Column(Text, nullable=True)
    parts_used = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    equipment = relationship("Equipment", back_populates="maintenance_records")

    __table_args__ = (
        Index("idx_maint_status_date", "status", "scheduled_date"),
    )
