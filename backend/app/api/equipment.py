from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.database import get_db
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate, EquipmentResponse
from app.services.health_service import EquipmentHealthService
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.get("", response_model=List[EquipmentResponse])
def list_equipment(
    search: Optional[str] = Query(None, description="Search by code, name, or location"),
    equipment_type: Optional[str] = Query(None, description="Filter by type (pump, compressor, motor, etc.)"),
    operational_status: Optional[str] = Query(None, description="Filter by status (operational, warning, critical, maintenance, offline)"),
    include_archived: bool = Query(False, description="Include archived equipment"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve equipment with flexible search, filtering, and computed live health indicators."""
    query = db.query(Equipment)

    if not include_archived:
        query = query.filter(Equipment.is_archived == False)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Equipment.equipment_code.ilike(search_fmt),
                Equipment.name.ilike(search_fmt),
                Equipment.location.ilike(search_fmt),
            )
        )

    if equipment_type:
        query = query.filter(Equipment.equipment_type == equipment_type)

    if operational_status:
        query = query.filter(Equipment.operational_status == operational_status)

    items = query.order_by(Equipment.id.asc()).offset(skip).limit(limit).all()

    # Enrich with active alert counts and health scores
    health_service = EquipmentHealthService(db)
    result = []
    for item in items:
        resp = EquipmentResponse.model_validate(item)
        resp.active_alerts_count = db.query(Alert).filter(
            Alert.equipment_id == item.id,
            Alert.status.in_(["open", "acknowledged"])
        ).count()

        latest = db.query(Telemetry).filter(
            Telemetry.equipment_id == item.id
        ).order_by(desc(Telemetry.timestamp)).first()

        if latest:
            resp.latest_telemetry_timestamp = latest.timestamp
            health = health_service.calculate_health(item)
            resp.health_score = health.health_score
            resp.health_category = health.health_category

        result.append(resp)

    return result


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(
    eq_in: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Register a new industrial equipment asset."""
    existing = db.query(Equipment).filter(Equipment.equipment_code == eq_in.equipment_code.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Equipment with code '{eq_in.equipment_code}' already exists.",
        )

    eq = Equipment(
        equipment_code=eq_in.equipment_code.strip().upper(),
        name=eq_in.name.strip(),
        equipment_type=eq_in.equipment_type.strip().lower(),
        location=eq_in.location.strip(),
        description=eq_in.description,
        operational_status=eq_in.operational_status,
        installation_date=eq_in.installation_date,
        sensor_thresholds=eq_in.sensor_thresholds,
    )
    db.add(eq)
    db.commit()
    db.refresh(eq)

    resp = EquipmentResponse.model_validate(eq)
    resp.active_alerts_count = 0
    resp.health_score = 100.0
    resp.health_category = "Good"
    return resp


@router.get("/{equipment_id}", response_model=EquipmentResponse)
def get_equipment_detail(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve detailed metadata for a single piece of equipment."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {equipment_id} not found",
        )

    resp = EquipmentResponse.model_validate(eq)
    resp.active_alerts_count = db.query(Alert).filter(
        Alert.equipment_id == eq.id,
        Alert.status.in_(["open", "acknowledged"])
    ).count()

    latest = db.query(Telemetry).filter(
        Telemetry.equipment_id == eq.id
    ).order_by(desc(Telemetry.timestamp)).first()

    if latest:
        resp.latest_telemetry_timestamp = latest.timestamp
        health_service = EquipmentHealthService(db)
        health = health_service.calculate_health(eq)
        resp.health_score = health.health_score
        resp.health_category = health.health_category

    return resp


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    eq_in: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Update equipment parameters, metadata, or sensor threshold envelopes."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {equipment_id} not found",
        )

    update_data = eq_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(eq, field, value)

    db.commit()
    db.refresh(eq)
    return get_equipment_detail(equipment_id=equipment_id, db=db, current_user=current_user)


@router.delete("/{equipment_id}", status_code=status.HTTP_200_OK)
def archive_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin"])),
) -> Any:
    """Archive equipment (soft delete) to preserve historical telemetry and maintenance records."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {equipment_id} not found",
        )

    eq.is_archived = True
    eq.operational_status = "offline"
    db.commit()
    return {"message": f"Equipment '{eq.equipment_code}' successfully archived"}
