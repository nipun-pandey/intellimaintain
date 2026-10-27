from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models.equipment import Equipment
from app.schemas.health import EquipmentHealthAssessment
from app.services.health_service import EquipmentHealthService
from app.ml.anomaly_detector import detector
from app.api.deps import get_current_user

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
def system_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """System liveness and readiness probe for Docker / orchestrator health checks."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "ml_engine": "ready" if detector.is_trained else "initializing",
        "version": "1.0.0",
    }


@router.get("/api/v1/health/equipment/{equipment_id}", response_model=EquipmentHealthAssessment)
def get_equipment_health_assessment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve detailed explainable health score, degradation penalties, and freshness state."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {equipment_id} not found",
        )

    service = EquipmentHealthService(db)
    return service.calculate_health(eq)


@router.post("/api/v1/seed-demo-data")
def trigger_seed_demo_data(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    """Convenience endpoint to populate database with realistic industrial equipment, telemetry, and alerts."""
    from app.seeds.seed_data import seed_database
    res = seed_database(db)
    return {"message": "Demo data successfully seeded", "details": res}
