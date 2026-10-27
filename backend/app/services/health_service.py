import datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.schemas.health import EquipmentHealthAssessment, ContributingFactor
from app.config import settings


class EquipmentHealthService:
    """
    Computes an explainable multi-factor health index (0 to 100) for equipment.
    Integrates telemetry freshness, threshold headroom, active alarms, and anomaly frequency.
    """

    def __init__(self, db: Session):
        self.db = db

    def calculate_health(self, equipment: Equipment) -> EquipmentHealthAssessment:
        now = datetime.datetime.utcnow()
        contributing_factors: List[ContributingFactor] = []
        active_conditions: List[str] = []

        # 1. Fetch latest telemetry and recent history (up to last 30 readings)
        recent_readings = self.db.query(Telemetry).filter(
            Telemetry.equipment_id == equipment.id
        ).order_by(desc(Telemetry.timestamp)).limit(30).all()

        latest_reading = recent_readings[0] if recent_readings else None

        # Base health starts at 100
        score = 100.0

        # Check telemetry freshness
        if not latest_reading:
            return EquipmentHealthAssessment(
                equipment_id=equipment.id,
                equipment_code=equipment.equipment_code,
                equipment_name=equipment.name,
                health_score=50.0,
                health_category="No Telemetry",
                telemetry_status="No Data",
                latest_telemetry_timestamp=None,
                minutes_since_last_reading=None,
                contributing_factors=[
                    ContributingFactor(
                        factor="Telemetry Availability",
                        impact="negative",
                        penalty_points=50.0,
                        detail="No telemetry recorded for this equipment. Health cannot be verified.",
                    )
                ],
                active_warning_conditions=["Awaiting initial telemetry stream"],
                assessment_explanation="Equipment health cannot be verified because no telemetry has been received.",
            )

        minutes_since_last = (now - latest_reading.timestamp).total_seconds() / 60.0
        telemetry_status = "Fresh"

        if minutes_since_last > 60:
            telemetry_status = "Offline"
            penalty = 35.0
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Stale Telemetry Data",
                impact="negative",
                penalty_points=penalty,
                detail=f"Telemetry signal is {int(minutes_since_last)} minutes old. Real-time condition is unverified.",
            ))
            active_conditions.append(f"Telemetry stale ({int(minutes_since_last)}m old)")
        elif minutes_since_last > 15:
            telemetry_status = "Stale"
            penalty = 15.0
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Telemetry Latency",
                impact="negative",
                penalty_points=penalty,
                detail=f"Telemetry latency is {int(minutes_since_last)} minutes. Sensor feed may be delayed.",
            ))
            active_conditions.append("Sensor feed delayed")

        # 2. Check active alerts
        active_alerts = self.db.query(Alert).filter(
            Alert.equipment_id == equipment.id,
            Alert.status.in_(["open", "acknowledged"])
        ).all()

        crit_count = sum(1 for a in active_alerts if a.severity == "critical")
        high_count = sum(1 for a in active_alerts if a.severity == "high")
        med_count = sum(1 for a in active_alerts if a.severity == "medium")

        if crit_count > 0:
            penalty = min(40.0, crit_count * 25.0)
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Critical Alarms",
                impact="negative",
                penalty_points=penalty,
                detail=f"{crit_count} active critical alarm(s) requiring immediate intervention.",
            ))
            active_conditions.append(f"{crit_count} Critical Alarm(s)")

        if high_count > 0:
            penalty = min(25.0, high_count * 12.0)
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="High Severity Alarms",
                impact="negative",
                penalty_points=penalty,
                detail=f"{high_count} high-severity warning(s) detected.",
            ))
            active_conditions.append(f"{high_count} High Severity Alarm(s)")

        if med_count > 0:
            penalty = min(15.0, med_count * 5.0)
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Advisory Alarms",
                impact="negative",
                penalty_points=penalty,
                detail=f"{med_count} medium/advisory alert(s) logged.",
            ))

        # 3. Check threshold margins from latest reading
        th = equipment.sensor_thresholds or {}
        temp_warn = float(th.get("temp_warn", settings.DEFAULT_TEMP_WARN_C))
        vib_warn = float(th.get("vib_warn", settings.DEFAULT_VIB_WARN_MMS))
        press_min = float(th.get("press_min", settings.DEFAULT_PRESS_MIN_BAR))
        press_max = float(th.get("press_max", settings.DEFAULT_PRESS_MAX_BAR))

        if latest_reading.temperature > temp_warn:
            penalty = 12.0
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Operating Temperature",
                impact="negative",
                penalty_points=penalty,
                detail=f"Current temperature {latest_reading.temperature:.1f}°C exceeds {temp_warn:.1f}°C warning threshold.",
            ))
            active_conditions.append(f"Temperature high: {latest_reading.temperature:.1f}°C")

        if latest_reading.vibration > vib_warn:
            penalty = 15.0
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Vibration Velocity",
                impact="negative",
                penalty_points=penalty,
                detail=f"Current vibration {latest_reading.vibration:.2f} mm/s exceeds ISO {vib_warn:.2f} mm/s limit.",
            ))
            active_conditions.append(f"Vibration high: {latest_reading.vibration:.2f} mm/s")

        if latest_reading.pressure < press_min or latest_reading.pressure > press_max:
            penalty = 10.0
            score -= penalty
            contributing_factors.append(ContributingFactor(
                factor="Operating Pressure",
                impact="negative",
                penalty_points=penalty,
                detail=f"Current pressure {latest_reading.pressure:.2f} bar outside [{press_min:.1f}, {press_max:.1f}] bar bounds.",
            ))

        # 4. Check ML anomaly frequency in recent window
        if recent_readings:
            anom_count = sum(1 for r in recent_readings if r.is_anomaly)
            anom_ratio = anom_count / len(recent_readings)
            if anom_ratio >= 0.20:
                penalty = min(20.0, anom_ratio * 30.0)
                score -= penalty
                contributing_factors.append(ContributingFactor(
                    factor="Isolation Forest Anomaly Density",
                    impact="negative",
                    penalty_points=penalty,
                    detail=f"{anom_count} of the last {len(recent_readings)} readings ({int(anom_ratio * 100)}%) were flagged as multivariate anomalies.",
                ))
                active_conditions.append(f"Frequent ML Anomalies ({int(anom_ratio * 100)}% density)")

        # Bound final score to [0.0, 100.0]
        final_score = max(5.0, min(100.0, score))

        # Categorize
        if telemetry_status in ["Stale", "Offline"] and minutes_since_last > 60:
            category = "Stale / Inconclusive"
        elif final_score >= 85.0:
            category = "Good"
        elif final_score >= 65.0:
            category = "Fair"
        elif final_score >= 40.0:
            category = "Poor"
        else:
            category = "Critical"

        if not contributing_factors:
            contributing_factors.append(ContributingFactor(
                factor="Nominal Operating Baseline",
                impact="positive",
                penalty_points=0.0,
                detail="All sensor channels within normal ISO/OEM envelopes with no active alarms.",
            ))
            explanation = "Equipment is operating smoothly within all configured process and vibration limits."
        else:
            primary_issues = [cf.factor for cf in contributing_factors if cf.impact == "negative"]
            explanation = f"Health impacted primarily by: {', '.join(primary_issues[:3])}."

        return EquipmentHealthAssessment(
            equipment_id=equipment.id,
            equipment_code=equipment.equipment_code,
            equipment_name=equipment.name,
            health_score=round(final_score, 1),
            health_category=category,
            telemetry_status=telemetry_status,
            latest_telemetry_timestamp=latest_reading.timestamp if latest_reading else None,
            minutes_since_last_reading=round(minutes_since_last, 1) if minutes_since_last is not None else None,
            contributing_factors=contributing_factors,
            active_warning_conditions=active_conditions,
            assessment_explanation=explanation,
        )
