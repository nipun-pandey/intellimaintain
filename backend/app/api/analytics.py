import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.database import get_db
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.models.maintenance import MaintenanceRecord
from app.services.health_service import EquipmentHealthService
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Dashboard"])


@router.get("/dashboard")
def get_dashboard_overview(
    days: int = Query(7, ge=1, le=90, description="Analysis window in days"),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns aggregated KPIs, health distributions, telemetry trends, and alarm matrices
    for the primary executive and engineering operations dashboard.
    """
    now = datetime.datetime.utcnow()
    window_start = now - datetime.timedelta(days=days)

    # 1. Equipment counts
    all_equipment = db.query(Equipment).filter(Equipment.is_archived == False).all()
    total_equipment = len(all_equipment)

    healthy_count = 0
    attention_count = 0
    critical_count = 0

    health_service = EquipmentHealthService(db)
    health_scores = []
    distribution = {"Good (85-100)": 0, "Fair (65-84)": 0, "Poor (40-64)": 0, "Critical (0-39)": 0, "Offline/Stale": 0}

    for eq in all_equipment:
        h = health_service.calculate_health(eq)
        health_scores.append(h.health_score)
        if h.health_category == "Good":
            healthy_count += 1
            distribution["Good (85-100)"] += 1
        elif h.health_category == "Fair":
            attention_count += 1
            distribution["Fair (65-84)"] += 1
        elif h.health_category == "Poor":
            attention_count += 1
            distribution["Poor (40-64)"] += 1
        elif h.health_category == "Critical":
            critical_count += 1
            distribution["Critical (0-39)"] += 1
        else:
            distribution["Offline/Stale"] += 1

    # 2. Alert KPIs
    active_alerts = db.query(Alert).filter(Alert.status.in_(["open", "acknowledged"])).all()
    active_alerts_count = len(active_alerts)
    critical_alerts_count = sum(1 for a in active_alerts if a.severity == "critical")
    high_alerts_count = sum(1 for a in active_alerts if a.severity == "high")

    # 3. Maintenance KPIs
    upcoming_maintenance = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.status == "scheduled",
        MaintenanceRecord.scheduled_date >= now
    ).count()

    overdue_maintenance = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.status.in_(["scheduled", "in_progress"]),
        MaintenanceRecord.scheduled_date < now
    ).count()

    completed_maintenance_window = db.query(MaintenanceRecord).filter(
        MaintenanceRecord.status == "completed",
        MaintenanceRecord.completion_date >= window_start
    ).count()

    # 4. Recent multi-asset trend samples (aggregate across telemetry)
    recent_readings = db.query(Telemetry).filter(
        Telemetry.timestamp >= window_start
    ).order_by(Telemetry.timestamp.asc()).all()

    # Downsample points for dashboard trend preview
    trend_points = []
    if recent_readings:
        step = max(1, len(recent_readings) // 20)
        for i in range(0, len(recent_readings), step):
            sub = recent_readings[i:i + step]
            avg_temp = sum(r.temperature for r in sub) / len(sub)
            avg_vib = sum(r.vibration for r in sub) / len(sub)
            avg_press = sum(r.pressure for r in sub) / len(sub)
            avg_curr = sum(r.motor_current for r in sub) / len(sub)
            trend_points.append({
                "time": sub[-1].timestamp.strftime("%b %d %H:%M"),
                "avg_temp": round(avg_temp, 1),
                "avg_vib": round(avg_vib, 2),
                "avg_press": round(avg_press, 2),
                "avg_curr": round(avg_curr, 1),
            })

    # 5. Latest 5 alerts
    latest_alerts = db.query(Alert).order_by(desc(Alert.timestamp)).limit(5).all()
    latest_alerts_list = [
        {
            "id": a.id,
            "equipment_id": a.equipment_id,
            "title": a.title,
            "severity": a.severity,
            "alert_type": a.alert_type,
            "status": a.status,
            "timestamp": a.timestamp.isoformat(),
        }
        for a in latest_alerts
    ]

    return {
        "kpis": {
            "total_equipment": total_equipment,
            "healthy_equipment": healthy_count,
            "attention_equipment": attention_count,
            "critical_equipment": critical_count,
            "active_alerts": active_alerts_count,
            "critical_alerts": critical_alerts_count,
            "high_alerts": high_alerts_count,
            "upcoming_maintenance": upcoming_maintenance,
            "overdue_maintenance": overdue_maintenance,
            "completed_maintenance_window": completed_maintenance_window,
            "system_mean_health": round(sum(health_scores) / max(1, len(health_scores)), 1) if health_scores else 100.0,
        },
        "health_distribution": distribution,
        "telemetry_trends": trend_points,
        "latest_alerts": latest_alerts_list,
    }
