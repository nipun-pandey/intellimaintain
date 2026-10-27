import datetime
from typing import Optional
from pydantic import BaseModel


class MaintenanceBase(BaseModel):
    equipment_id: int
    title: str
    description: Optional[str] = None
    maintenance_type: str = "preventive"  # preventive, corrective, inspection, emergency, calibration
    priority: str = "medium"              # low, medium, high, critical
    scheduled_date: datetime.datetime
    assigned_technician: Optional[str] = None
    work_performed: Optional[str] = None
    parts_used: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceCreate(MaintenanceBase):
    status: str = "scheduled"


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    maintenance_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    scheduled_date: Optional[datetime.datetime] = None
    completion_date: Optional[datetime.datetime] = None
    assigned_technician: Optional[str] = None
    work_performed: Optional[str] = None
    parts_used: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceComplete(BaseModel):
    completion_date: Optional[datetime.datetime] = None
    work_performed: str
    parts_used: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceResponse(MaintenanceBase):
    id: int
    status: str
    completion_date: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True
