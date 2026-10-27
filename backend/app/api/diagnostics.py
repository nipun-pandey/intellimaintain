from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.equipment import Equipment
from app.schemas.diagnostics import DiagnosticReport
from app.services.diagnostic_engine import IndustrialDiagnosticEngine
from app.api.deps import get_current_user

router = APIRouter(prefix="/diagnostics", tags=["AI Diagnostics"])


@router.get("/equipment/{equipment_id}", response_model=DiagnosticReport)
def get_equipment_diagnostic_report(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Generate evidence-based diagnostic assessment for an industrial asset.
    Extracts live telemetry, threshold violations, active alarms, and maintenance history,
    then executes deterministic FMEA rules or Gemini LLM reasoning.
    """
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {equipment_id} not found",
        )

    engine = IndustrialDiagnosticEngine(db)
    report = engine.generate_diagnostic_report(equipment)
    return report
