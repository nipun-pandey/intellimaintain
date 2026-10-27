from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.equipment import Equipment
from app.schemas.simulator import SimulatorConfig, SimulatorStatus
from app.services.simulator_service import simulator_manager
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/simulator", tags=["Telemetry Simulator"])


@router.get("/status", response_model=SimulatorStatus)
def get_simulator_status(
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve the real-time operational status of the telemetry simulator."""
    return simulator_manager.get_status()


@router.post("/start", response_model=SimulatorStatus)
async def start_simulation(
    config: SimulatorConfig,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """
    Launch simulated telemetry streaming for a designated equipment asset.
    Scenarios: 'normal', 'deterioration', 'anomaly', 'sensor_failure', 'communication_interruption'.
    """
    eq = db.query(Equipment).filter(Equipment.id == config.equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {config.equipment_id} not found",
        )

    simulator_manager.start(
        equipment_id=config.equipment_id,
        scenario=config.scenario,
        interval_seconds=config.interval_seconds,
    )

    return simulator_manager.get_status()


@router.post("/stop", response_model=SimulatorStatus)
async def stop_simulation(
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Gracefully halt active telemetry generation."""
    simulator_manager.stop()
    return simulator_manager.get_status()


@router.post("/reset", response_model=SimulatorStatus)
async def reset_simulation(
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Reset simulation step counts and clear volatile test buffers."""
    simulator_manager.reset()
    return simulator_manager.get_status()


@router.get("/recent-readings", response_model=List[Dict[str, Any]])
def get_recent_simulator_readings(
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve buffered stream of readings emitted during the current simulation run."""
    return simulator_manager.get_recent_readings()
