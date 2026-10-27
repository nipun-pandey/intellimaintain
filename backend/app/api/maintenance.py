import datetime
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.database import get_db
from app.models.maintenance import MaintenanceRecord
from app.models.equipment import Equipment
from app.schemas.maintenance import (
    MaintenanceCreate,
    MaintenanceUpdate,
    MaintenanceComplete,
    MaintenanceResponse,
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.get("", response_model=List[MaintenanceResponse])
def list_maintenance_records(
    equipment_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="scheduled, in_progress, completed, cancelled, overdue, upcoming"),
    priority: Optional[str] = Query(None, description="low, medium, high, critical"),
    maintenance_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve maintenance work orders and servicing logs."""
    query = db.query(MaintenanceRecord)
    now = datetime.datetime.utcnow()

    if equipment_id:
        query = query.filter(MaintenanceRecord.equipment_id == equipment_id)
    if priority:
        query = query.filter(MaintenanceRecord.priority == priority)
    if maintenance_type:
        query = query.filter(MaintenanceRecord.maintenance_type == maintenance_type)

    if status == "overdue":
        query = query.filter(
            MaintenanceRecord.status.in_(["scheduled", "in_progress"]),
            MaintenanceRecord.scheduled_date < now
        )
    elif status == "upcoming":
        query = query.filter(
            MaintenanceRecord.status == "scheduled",
            MaintenanceRecord.scheduled_date >= now
        )
    elif status:
        query = query.filter(MaintenanceRecord.status == status)

    return query.order_by(asc(MaintenanceRecord.scheduled_date)).offset(skip).limit(limit).all()


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance_record(
    record_in: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Schedule or log a new maintenance event."""
    eq = db.query(Equipment).filter(Equipment.id == record_in.equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {record_in.equipment_id} not found",
        )

    record = MaintenanceRecord(**record_in.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=MaintenanceResponse)
def get_maintenance_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve a single maintenance work order."""
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance record {record_id} not found",
        )
    return record


@router.put("/{record_id}", response_model=MaintenanceResponse)
def update_maintenance_record(
    record_id: int,
    record_in: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Update details, schedule, or notes for a maintenance record."""
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance record {record_id} not found",
        )

    update_data = record_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.post("/{record_id}/complete", response_model=MaintenanceResponse)
def complete_maintenance(
    record_id: int,
    complete_in: MaintenanceComplete,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Mark a maintenance work order as completed with technician debrief notes."""
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance record {record_id} not found",
        )

    record.status = "completed"
    record.completion_date = complete_in.completion_date or datetime.datetime.utcnow()
    record.work_performed = complete_in.work_performed
    if complete_in.parts_used:
        record.parts_used = complete_in.parts_used
    if complete_in.notes:
        record.notes = complete_in.notes

    db.commit()
    db.refresh(record)
    return record
