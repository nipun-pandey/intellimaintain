import datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert, AlertRule
from app.config import settings


class AlertEngine:
    """
    Industrial alert evaluation and deduplication engine.
    Detects threshold breaches, rate-of-change spikes, ML anomalies, and stale signals.
    """

    def __init__(self, db: Session):
        self.db = db

    def evaluate_telemetry_reading(
        self,
        equipment: Equipment,
        reading: Telemetry,
        previous_reading: Optional[Telemetry] = None
    ) -> List[Alert]:
        """
        Evaluates a newly ingested telemetry reading against equipment thresholds,
        rate-of-change criteria, and machine learning anomaly flags.
        """
        created_alerts: List[Alert] = []

        # Read thresholds from equipment record or fall back to system defaults
        th = equipment.sensor_thresholds or {}
        temp_warn = float(th.get("temp_warn", settings.DEFAULT_TEMP_WARN_C))
        temp_crit = float(th.get("temp_crit", settings.DEFAULT_TEMP_CRIT_C))
        vib_warn = float(th.get("vib_warn", settings.DEFAULT_VIB_WARN_MMS))
        vib_crit = float(th.get("vib_crit", settings.DEFAULT_VIB_CRIT_MMS))
        press_min = float(th.get("press_min", settings.DEFAULT_PRESS_MIN_BAR))
        press_max = float(th.get("press_max", settings.DEFAULT_PRESS_MAX_BAR))
        current_max = float(th.get("current_max", settings.DEFAULT_CURRENT_MAX_A))

        now = reading.timestamp or datetime.datetime.utcnow()

        # 1. Temperature Check
        if reading.temperature >= temp_crit:
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity="critical",
                title=f"Critical Overheating on {equipment.equipment_code}",
                description=f"Measured temperature of {reading.temperature:.1f}°C exceeds critical threshold ({temp_crit:.1f}°C). Imminent thermal trip risk.",
                measurement={"metric": "temperature", "value": reading.temperature, "unit": "°C", "threshold": temp_crit},
                reason=f"Temperature {reading.temperature:.1f}°C >= Critical {temp_crit:.1f}°C",
                cooldown_key=f"eq-{equipment.id}:temp:critical",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)
        elif reading.temperature >= temp_warn:
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity="high",
                title=f"High Temperature Warning on {equipment.equipment_code}",
                description=f"Measured temperature of {reading.temperature:.1f}°C exceeds warning threshold ({temp_warn:.1f}°C). Cooling subsystem inspection recommended.",
                measurement={"metric": "temperature", "value": reading.temperature, "unit": "°C", "threshold": temp_warn},
                reason=f"Temperature {reading.temperature:.1f}°C >= Warning {temp_warn:.1f}°C",
                cooldown_key=f"eq-{equipment.id}:temp:warning",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)

        # 2. Vibration Check (ISO 10816 Standard)
        if reading.vibration >= vib_crit:
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity="critical",
                title=f"Severe Mechanical Vibration on {equipment.equipment_code}",
                description=f"RMS vibration velocity of {reading.vibration:.2f} mm/s violates ISO 10816 Zone D critical boundary ({vib_crit:.2f} mm/s). Severe mechanical damage likely.",
                measurement={"metric": "vibration", "value": reading.vibration, "unit": "mm/s RMS", "threshold": vib_crit},
                reason=f"Vibration {reading.vibration:.2f} mm/s >= Critical {vib_crit:.2f} mm/s",
                cooldown_key=f"eq-{equipment.id}:vib:critical",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)
        elif reading.vibration >= vib_warn:
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity="medium",
                title=f"Elevated Vibration on {equipment.equipment_code}",
                description=f"RMS vibration velocity of {reading.vibration:.2f} mm/s exceeds advisory limit ({vib_warn:.2f} mm/s). Check dynamic balancing and shaft alignment.",
                measurement={"metric": "vibration", "value": reading.vibration, "unit": "mm/s RMS", "threshold": vib_warn},
                reason=f"Vibration {reading.vibration:.2f} mm/s >= Warning {vib_warn:.2f} mm/s",
                cooldown_key=f"eq-{equipment.id}:vib:warning",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)

        # 3. Pressure Range Check
        if reading.pressure < press_min or reading.pressure > press_max:
            severity = "high" if (reading.pressure < press_min * 0.7 or reading.pressure > press_max * 1.3) else "medium"
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity=severity,
                title=f"Pressure Out-of-Spec on {equipment.equipment_code}",
                description=f"Operating pressure {reading.pressure:.2f} bar outside safe operating range [{press_min:.1f} - {press_max:.1f} bar].",
                measurement={"metric": "pressure", "value": reading.pressure, "unit": "bar", "range": [press_min, press_max]},
                reason=f"Pressure {reading.pressure:.2f} bar out of range [{press_min:.1f}, {press_max:.1f}]",
                cooldown_key=f"eq-{equipment.id}:press:range",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)

        # 4. Motor Current Check
        if reading.motor_current >= current_max:
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="threshold_violation",
                severity="high",
                title=f"Motor Overcurrent on {equipment.equipment_code}",
                description=f"Motor draw {reading.motor_current:.1f} A exceeds full-load rating ({current_max:.1f} A). Risk of motor winding breakdown.",
                measurement={"metric": "motor_current", "value": reading.motor_current, "unit": "A", "threshold": current_max},
                reason=f"Current {reading.motor_current:.1f} A >= Max {current_max:.1f} A",
                cooldown_key=f"eq-{equipment.id}:current:overload",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)

        # 5. Rapid Rate-of-Change Check (e.g. thermal or vibration transient)
        if previous_reading:
            delta_temp = abs(reading.temperature - previous_reading.temperature)
            delta_vib = abs(reading.vibration - previous_reading.vibration)

            if delta_temp >= 12.0:
                alert = self._create_or_suppress_alert(
                    equipment_id=equipment.id,
                    alert_type="rapid_change",
                    severity="high",
                    title=f"Sudden Thermal Transient on {equipment.equipment_code}",
                    description=f"Temperature jumped by {delta_temp:.1f}°C in consecutive readings ({previous_reading.temperature:.1f}°C -> {reading.temperature:.1f}°C).",
                    measurement={"metric": "temperature_delta", "delta": delta_temp, "unit": "°C"},
                    reason=f"Thermal rate-of-change spike: +{delta_temp:.1f}°C",
                    cooldown_key=f"eq-{equipment.id}:temp:rapid_jump",
                    timestamp=now,
                )
                if alert:
                    created_alerts.append(alert)

            if delta_vib >= 3.5:
                alert = self._create_or_suppress_alert(
                    equipment_id=equipment.id,
                    alert_type="rapid_change",
                    severity="high",
                    title=f"Vibration Transient Step on {equipment.equipment_code}",
                    description=f"Vibration jumped by {delta_vib:.2f} mm/s ({previous_reading.vibration:.2f} -> {reading.vibration:.2f} mm/s).",
                    measurement={"metric": "vibration_delta", "delta": delta_vib, "unit": "mm/s RMS"},
                    reason=f"Vibration shock transient: +{delta_vib:.2f} mm/s",
                    cooldown_key=f"eq-{equipment.id}:vib:rapid_jump",
                    timestamp=now,
                )
                if alert:
                    created_alerts.append(alert)

        # 6. Machine Learning Anomaly Detection Alert
        if reading.is_anomaly:
            score = reading.anomaly_score or 0.75
            severity = "critical" if score >= 0.85 else ("high" if score >= 0.70 else "medium")
            alert = self._create_or_suppress_alert(
                equipment_id=equipment.id,
                alert_type="ml_anomaly",
                severity=severity,
                title=f"AI Anomaly Detected on {equipment.equipment_code}",
                description=f"Isolation Forest identified multivariate operational outlier (Anomaly Score: {score:.2f}). Operating state deviates from learned normal cluster.",
                measurement={"metric": "anomaly_score", "value": score, "unit": "score [0-1]"},
                reason=f"Multivariate Isolation Forest outlier score: {score:.2f}",
                cooldown_key=f"eq-{equipment.id}:ml:anomaly",
                timestamp=now,
            )
            if alert:
                created_alerts.append(alert)

        # Update equipment status based on alerts and readings
        self._update_equipment_status(equipment, reading, created_alerts)

        return created_alerts

    def _create_or_suppress_alert(
        self,
        equipment_id: int,
        alert_type: str,
        severity: str,
        title: str,
        description: str,
        measurement: Dict[str, Any],
        reason: str,
        cooldown_key: str,
        timestamp: datetime.datetime,
        cooldown_seconds: int = 300,
    ) -> Optional[Alert]:
        """
        Deduplication logic: Checks if an identical open alert or recently resolved
        alert exists within the cooldown period to prevent alert flooding.
        """
        cooldown_threshold = timestamp - datetime.timedelta(seconds=cooldown_seconds)

        # Query recent alerts matching equipment and cooldown_key
        existing_alert = self.db.query(Alert).filter(
            Alert.equipment_id == equipment_id,
            Alert.cooldown_key == cooldown_key,
            Alert.timestamp >= cooldown_threshold,
            Alert.status != "resolved",
        ).first()

        if existing_alert:
            # Suppressed due to active cooldown
            return None

        alert = Alert(
            equipment_id=equipment_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            triggering_measurement=measurement,
            detection_reason=reason,
            cooldown_key=cooldown_key,
            status="open",
            timestamp=timestamp,
        )
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def _update_equipment_status(
        self,
        equipment: Equipment,
        reading: Telemetry,
        recent_alerts: List[Alert],
    ):
        """Updates operational status on the equipment model."""
        open_criticals = self.db.query(Alert).filter(
            Alert.equipment_id == equipment.id,
            Alert.status == "open",
            Alert.severity == "critical"
        ).count()

        open_highs = self.db.query(Alert).filter(
            Alert.equipment_id == equipment.id,
            Alert.status == "open",
            Alert.severity.in_(["high", "medium"])
        ).count()

        if open_criticals > 0:
            equipment.operational_status = "critical"
        elif open_highs > 0:
            equipment.operational_status = "warning"
        elif equipment.operational_status not in ["maintenance", "offline"]:
            equipment.operational_status = "operational"

        self.db.commit()

    def check_stale_telemetry(self, stale_threshold_minutes: int = 15) -> List[Alert]:
        """Scans for active equipment with missing or stale telemetry signals."""
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=stale_threshold_minutes)
        all_equipment = self.db.query(Equipment).filter(
            Equipment.is_archived == False,
            Equipment.operational_status != "offline"
        ).all()

        created_stale_alerts = []
        for eq in all_equipment:
            last_reading = self.db.query(Telemetry).filter(
                Telemetry.equipment_id == eq.id
            ).order_by(desc(Telemetry.timestamp)).first()

            if not last_reading or last_reading.timestamp < cutoff:
                last_time_str = last_reading.timestamp.isoformat() if last_reading else "Never"
                alert = self._create_or_suppress_alert(
                    equipment_id=eq.id,
                    alert_type="stale_telemetry",
                    severity="medium",
                    title=f"Telemetry Interruption on {eq.equipment_code}",
                    description=f"No telemetry received for over {stale_threshold_minutes} minutes. Last signal: {last_time_str}.",
                    measurement={"last_seen": last_time_str, "stale_minutes": stale_threshold_minutes},
                    reason="Signal timeout - possible sensor drop, network outage, or edge gateway failure",
                    cooldown_key=f"eq-{eq.id}:telemetry:stale",
                    timestamp=datetime.datetime.utcnow(),
                    cooldown_seconds=1800,  # 30 min cooldown
                )
                if alert:
                    created_stale_alerts.append(alert)

        return created_stale_alerts
