import datetime
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models.alert import Alert, AlertRule
from app.models.equipment import Equipment
from app.schemas.alert import (
    AlertResponse,
    AlertAcknowledge,
    AlertResolve,
    AlertRuleCreate,
    AlertRuleResponse,
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
def list_alerts(
    equipment_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="open, acknowledged, resolved"),
    severity: Optional[str] = Query(None, description="low, medium, high, critical"),
    alert_type: Optional[str] = Query(None, description="threshold_violation, ml_anomaly, stale_telemetry, rapid_change"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Query equipment alerts with multi-dimensional filtering."""
    query = db.query(Alert)

    if equipment_id:
        query = query.filter(Alert.equipment_id == equipment_id)
    if status:
        query = query.filter(Alert.status == status)
    if severity:
        query = query.filter(Alert.severity == severity)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)

    return query.order_by(desc(Alert.timestamp)).offset(skip).limit(limit).all()


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert_detail(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve details for a single alarm record."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )
    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    ack_in: Optional[AlertAcknowledge] = None,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Transition alert state from Open -> Acknowledged."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )

    if alert.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot acknowledge an already resolved alert",
        )

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.datetime.utcnow()
    alert.acknowledged_by = (ack_in.acknowledged_by if ack_in and ack_in.acknowledged_by else current_user.full_name)

    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: int,
    resolve_in: AlertResolve,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Transition alert state to Resolved with documented engineer corrective notes."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )

    alert.status = "resolved"
    alert.resolved_at = datetime.datetime.utcnow()
    alert.resolved_by = resolve_in.resolved_by or current_user.full_name
    alert.resolution_notes = resolve_in.resolution_notes

    # Re-evaluate equipment operational status
    eq = db.query(Equipment).filter(Equipment.id == alert.equipment_id).first()
    if eq:
        remaining_crits = db.query(Alert).filter(
            Alert.equipment_id == eq.id,
            Alert.id != alert.id,
            Alert.status == "open",
            Alert.severity == "critical"
        ).count()
        remaining_highs = db.query(Alert).filter(
            Alert.equipment_id == eq.id,
            Alert.id != alert.id,
            Alert.status == "open",
            Alert.severity.in_(["high", "medium"])
        ).count()

        if remaining_crits > 0:
            eq.operational_status = "critical"
        elif remaining_highs > 0:
            eq.operational_status = "warning"
        elif eq.operational_status not in ["maintenance", "offline"]:
            eq.operational_status = "operational"

    db.commit()
    db.refresh(alert)
    return alert


# Alert Rules Endpoints
@router.get("/rules/list", response_model=List[AlertRuleResponse])
def list_alert_rules(
    equipment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """List configured threshold rules."""
    query = db.query(AlertRule)
    if equipment_id:
        query = query.filter(AlertRule.equipment_id == equipment_id)
    return query.all()


@router.post("/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    rule_in: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(require_role(["admin", "engineer"])),
) -> Any:
    """Create a customized threshold rule."""
    rule = AlertRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule
