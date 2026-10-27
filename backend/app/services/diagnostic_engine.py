import datetime
import json
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.models.maintenance import MaintenanceRecord
from app.schemas.diagnostics import DiagnosticReport, MeasuredEvidence, DiagnosticCheck
from app.config import settings


class IndustrialDiagnosticEngine:
    """
    Expert AI diagnostic assistant for industrial assets.
    Combines deterministic domain-expert diagnostic trees with an optional Gemini LLM integration.
    """

    def __init__(self, db: Session):
        self.db = db

    def generate_diagnostic_report(self, equipment: Equipment) -> DiagnosticReport:
        now = datetime.datetime.utcnow()

        # 1. Gather true empirical evidence from database (Never invent data)
        recent_telemetry = self.db.query(Telemetry).filter(
            Telemetry.equipment_id == equipment.id
        ).order_by(desc(Telemetry.timestamp)).limit(20).all()

        active_alerts = self.db.query(Alert).filter(
            Alert.equipment_id == equipment.id,
            Alert.status.in_(["open", "acknowledged"])
        ).order_by(desc(Alert.timestamp)).all()

        recent_maintenance = self.db.query(MaintenanceRecord).filter(
            MaintenanceRecord.equipment_id == equipment.id
        ).order_by(desc(MaintenanceRecord.scheduled_date)).limit(5).all()

        # 2. Build structured measured evidence
        latest = recent_telemetry[0] if recent_telemetry else None
        th = equipment.sensor_thresholds or {}

        measured_evidence: List[MeasuredEvidence] = []
        if latest:
            temp_warn = float(th.get("temp_warn", settings.DEFAULT_TEMP_WARN_C))
            vib_warn = float(th.get("vib_warn", settings.DEFAULT_VIB_WARN_MMS))
            press_min = float(th.get("press_min", settings.DEFAULT_PRESS_MIN_BAR))
            press_max = float(th.get("press_max", settings.DEFAULT_PRESS_MAX_BAR))
            curr_max = float(th.get("current_max", settings.DEFAULT_CURRENT_MAX_A))

            # Temperature
            temp_status = "Critical" if latest.temperature >= float(th.get("temp_crit", settings.DEFAULT_TEMP_CRIT_C)) else ("Warning" if latest.temperature >= temp_warn else "Normal")
            measured_evidence.append(MeasuredEvidence(
                metric="Bearing / Core Temperature",
                latest_value=latest.temperature,
                unit="°C",
                threshold=f"Warning: {temp_warn}°C, Critical: {th.get('temp_crit', settings.DEFAULT_TEMP_CRIT_C)}°C",
                status=temp_status,
                historical_context=f"Avg over last 20 samples: {sum(t.temperature for t in recent_telemetry)/len(recent_telemetry):.1f}°C"
            ))

            # Vibration
            vib_status = "Critical" if latest.vibration >= float(th.get("vib_crit", settings.DEFAULT_VIB_CRIT_MMS)) else ("Warning" if latest.vibration >= vib_warn else "Normal")
            measured_evidence.append(MeasuredEvidence(
                metric="Vibration Velocity (ISO 10816)",
                latest_value=latest.vibration,
                unit="mm/s RMS",
                threshold=f"Warning: {vib_warn} mm/s, Critical: {th.get('vib_crit', settings.DEFAULT_VIB_CRIT_MMS)} mm/s",
                status=vib_status,
                historical_context=f"Avg over last 20 samples: {sum(t.vibration for t in recent_telemetry)/len(recent_telemetry):.2f} mm/s"
            ))

            # Pressure
            press_status = "Warning" if (latest.pressure < press_min or latest.pressure > press_max) else "Normal"
            measured_evidence.append(MeasuredEvidence(
                metric="Discharge / Hydraulic Pressure",
                latest_value=latest.pressure,
                unit="bar",
                threshold=f"Normal envelope: [{press_min} - {press_max} bar]",
                status=press_status,
                historical_context=f"Avg over last 20 samples: {sum(t.pressure for t in recent_telemetry)/len(recent_telemetry):.2f} bar"
            ))

            # Motor current
            curr_status = "Warning" if latest.motor_current >= curr_max else "Normal"
            measured_evidence.append(MeasuredEvidence(
                metric="Motor Phase Current",
                latest_value=latest.motor_current,
                unit="A",
                threshold=f"FLA max: {curr_max} A",
                status=curr_status,
                historical_context=f"Avg over last 20 samples: {sum(t.motor_current for t in recent_telemetry)/len(recent_telemetry):.1f} A"
            ))

            # RPM if available
            if latest.speed_rpm is not None:
                measured_evidence.append(MeasuredEvidence(
                    metric="Rotational Shaft Speed",
                    latest_value=latest.speed_rpm,
                    unit="RPM",
                    threshold="Nominal ±50 RPM",
                    status="Normal",
                    historical_context=f"Latest reading: {latest.speed_rpm:.0f} RPM"
                ))

        # 3. Determine if Gemini LLM API should be attempted
        if settings.GEMINI_API_KEY:
            try:
                llm_report = self._call_gemini_diagnostics(
                    equipment=equipment,
                    measured_evidence=measured_evidence,
                    active_alerts=active_alerts,
                    recent_maintenance=recent_maintenance,
                )
                if llm_report:
                    return llm_report
            except Exception:
                # Silently fallback to deterministic domain expert rules
                pass

        # 4. Deterministic Rule-Based Fallback
        return self._rule_based_diagnostics(
            equipment=equipment,
            latest=latest,
            measured_evidence=measured_evidence,
            active_alerts=active_alerts,
            recent_maintenance=recent_maintenance,
        )

    def _rule_based_diagnostics(
        self,
        equipment: Equipment,
        latest: Optional[Telemetry],
        measured_evidence: List[MeasuredEvidence],
        active_alerts: List[Alert],
        recent_maintenance: List[MaintenanceRecord],
    ) -> DiagnosticReport:
        """
        Deterministic, engineering-grounded failure mode & effects analysis (FMEA).
        """
        now = datetime.datetime.utcnow()
        possible_causes: List[str] = []
        suggested_checks: List[DiagnosticCheck] = []
        recommended_actions: List[str] = []
        risk_level = "Low"

        if not latest:
            return DiagnosticReport(
                equipment_id=equipment.id,
                equipment_code=equipment.equipment_code,
                equipment_name=equipment.name,
                generated_at=now,
                engine_used="Deterministic Rule-Based Expert System",
                observations_summary="No telemetry data is currently available for this equipment.",
                measured_evidence=[],
                possible_causes=["Sensor hardware disconnected", "Edge gateway communication failure", "Equipment recently commissioned"],
                suggested_checks=[
                    DiagnosticCheck(
                        check_name="Telemetry Link Verification",
                        subsystem="Instrumentation",
                        procedure="Inspect edge gateway Ethernet/cellular link and verify 24V DC sensor power loop.",
                        priority="Immediate"
                    )
                ],
                recommended_actions=["Deploy instrument technician to verify sensor loop and edge broker status."],
                uncertainty_and_limitations="Without live sensor signals, automated physical condition assessment is impossible.",
                risk_level="Elevated"
            )

        # Failure mode patterns
        has_high_vib = any(e.metric.startswith("Vibration") and e.status in ["Warning", "Critical"] for e in measured_evidence)
        has_high_temp = any(e.metric.startswith("Bearing") and e.status in ["Warning", "Critical"] for e in measured_evidence)
        has_press_issue = any(e.metric.startswith("Discharge") and e.status != "Normal" for e in measured_evidence)
        has_high_current = any(e.metric.startswith("Motor") and e.status != "Normal" for e in measured_evidence)

        # Pattern 1: High Vibration + High Temperature = Bearing / Misalignment
        if has_high_vib and has_high_temp:
            risk_level = "Critical"
            possible_causes.append("Severe bearing element fatigue, spalling, or loss of lubrication film.")
            possible_causes.append("Angular or parallel shaft misalignment causing frictional heating and 2X rotational harmonic vibration.")
            suggested_checks.append(DiagnosticCheck(
                check_name="Bearing Acoustic & Thermal Inspection",
                subsystem="Mechanical",
                procedure="Measure drive-end and non-drive-end housing temperatures with calibrated infrared pyrometer and collect high-frequency ultrasonic bearing emission spectrum.",
                priority="Immediate"
            ))
            suggested_checks.append(DiagnosticCheck(
                check_name="Laser Shaft Alignment Check",
                subsystem="Mechanical",
                procedure="Mount dual-detector laser alignment fixtures to inspect radial and axial coupling offset under cold and hot operating conditions.",
                priority="High"
            ))
            recommended_actions.append("Reduce operating load or schedule an emergency window to grease bearings and inspect coupling elastomer.")

        # Pattern 2: High Vibration alone = Unbalance / Looseness / Cavitation
        elif has_high_vib:
            risk_level = "Elevated"
            possible_causes.append("Dynamic impeller or rotor unbalance due to particulate buildup or missing balance weights.")
            possible_causes.append("Mechanical structural looseness in foundation bolts or frame resonance.")
            if equipment.equipment_type in ["pump", "turbine"]:
                possible_causes.append("Hydraulic cavitation or recirculation due to low Net Positive Suction Head (NPSH).")
            suggested_checks.append(DiagnosticCheck(
                check_name="FFT Vibration Spectrum Analysis",
                subsystem="Mechanical",
                procedure="Perform narrow-band FFT spectral decomposition to distinguish 1X unbalance peaks from 2X/3X harmonics or 10X-40X blade-pass cavitation frequencies.",
                priority="Immediate"
            ))
            suggested_checks.append(DiagnosticCheck(
                check_name="Foundation Anchor Torque Check",
                subsystem="Mechanical",
                procedure="Verify baseplate holding-down bolts with a calibrated torque wrench against OEM specifications.",
                priority="High"
            ))
            recommended_actions.append("Schedule dynamic rebalancing and suction strainer cleaning during the next shift change.")

        # Pattern 3: High Temperature + High Current = Electrical overload / Mechanical binding
        elif has_high_temp and has_high_current:
            risk_level = "Critical"
            possible_causes.append("Motor stator winding insulation breakdown or phase-to-phase current imbalance.")
            possible_causes.append("Internal mechanical drag, tight seals, or heavy process fluid viscosity overload.")
            suggested_checks.append(DiagnosticCheck(
                check_name="Motor Insulation Resistance (Megger Test)",
                subsystem="Electrical",
                procedure="Disconnect power feed and measure phase-to-ground insulation resistance at 1000V DC (minimum 5 MΩ per IEEE 43).",
                priority="Immediate"
            ))
            suggested_checks.append(DiagnosticCheck(
                check_name="3-Phase Current Balance Audit",
                subsystem="Electrical",
                procedure="Record L1, L2, L3 clamp-meter currents; verify current imbalance is within 5%.",
                priority="High"
            ))
            recommended_actions.append("Verify circuit breaker thermal overload trip settings and check motor cooling fan shroud for blockages.")

        # Pattern 4: High Temperature alone = Cooling degradation / Lubrication starvation
        elif has_high_temp:
            risk_level = "Elevated"
            possible_causes.append("Lubricant oil breakdown, varnish formation, or inadequate oil replenishment.")
            possible_causes.append("Fouled heat exchanger jacket, air-cooling fins clogged with dust, or ventilation failure.")
            suggested_checks.append(DiagnosticCheck(
                check_name="Lubricant Quality & Level Inspection",
                subsystem="Mechanical",
                procedure="Examine sight glass oil level, draw 50 mL sample for visual appearance, viscosity, and moisture discoloration.",
                priority="Immediate"
            ))
            suggested_checks.append(DiagnosticCheck(
                check_name="Cooling Subsystem Airflow / Coolant Delta-T",
                subsystem="Thermal",
                procedure="Measure inlet versus outlet coolant temperatures and confirm forced ventilation fan operation.",
                priority="Medium"
            ))
            recommended_actions.append("Clean radiator fins with low-pressure compressed air and top off ISO VG lubricant reservoir.")

        # Pattern 5: Pressure issue
        elif has_press_issue:
            risk_level = "Moderate"
            possible_causes.append("Discharge check valve leakage, relief valve setpoint drift, or suction strainer clogging.")
            suggested_checks.append(DiagnosticCheck(
                check_name="Differential Pressure Across Filters",
                subsystem="Hydraulic",
                procedure="Measure differential pressure between suction and discharge manifolds to isolate filter restriction.",
                priority="High"
            ))
            recommended_actions.append("Cycle manual isolation valves and inspect pressure transmitter calibration.")

        # Nominal operating state
        else:
            risk_level = "Low"
            possible_causes.append("Asset is running within nominal design boundaries. No active degradation detected.")
            suggested_checks.append(DiagnosticCheck(
                check_name="Routine Preventive Walkdown",
                subsystem="Mechanical",
                procedure="Perform standard visual walk-around inspection, check for oil leaks, and log operating hours.",
                priority="Routine"
            ))
            recommended_actions.append("Maintain standard OEM inspection schedule. Next scheduled preventive service should follow plan.")

        # Format summary
        crit_alerts = [a for a in active_alerts if a.severity == "critical"]
        summary = (
            f"Asset {equipment.equipment_code} ({equipment.name}) currently displays {risk_level.lower()} risk profile. "
            f"Evaluated {len(measured_evidence)} sensor parameters and {len(active_alerts)} active alarm(s). "
        )
        if crit_alerts:
            summary += f"Requires urgent attention due to {len(crit_alerts)} active critical alert(s): '{crit_alerts[0].title}'."
        elif has_high_vib or has_high_temp:
            summary += "Physical telemetry reflects elevated mechanical or thermal stress exceeding normal bounds."
        else:
            summary += "Operating conditions and telemetry streams are stable."

        return DiagnosticReport(
            equipment_id=equipment.id,
            equipment_code=equipment.equipment_code,
            equipment_name=equipment.name,
            generated_at=now,
            engine_used="Deterministic Rule-Based Expert System",
            observations_summary=summary,
            measured_evidence=measured_evidence,
            possible_causes=possible_causes,
            suggested_checks=suggested_checks,
            recommended_actions=recommended_actions,
            uncertainty_and_limitations=(
                "Diagnostic hypotheses are generated deterministically based on standard ISO 10816 vibration guidelines, "
                "thermal threshold limits, and historical FMEA tables. Real-world machinery root-cause verification always "
                "requires physical non-destructive inspection by qualified plant reliability engineers."
            ),
            risk_level=risk_level,
        )

    def _call_gemini_diagnostics(
        self,
        equipment: Equipment,
        measured_evidence: List[MeasuredEvidence],
        active_alerts: List[Alert],
        recent_maintenance: List[MaintenanceRecord],
    ) -> Optional[DiagnosticReport]:
        """Calls Gemini API if available to generate rich, synthesized diagnostic insights."""
        now = datetime.datetime.utcnow()
        prompt_payload = {
            "equipment_code": equipment.equipment_code,
            "equipment_type": equipment.equipment_type,
            "equipment_name": equipment.name,
            "measured_evidence": [e.dict() for e in measured_evidence],
            "active_alerts": [{"title": a.title, "severity": a.severity, "desc": a.description} for a in active_alerts],
            "recent_maintenance": [{"title": m.title, "date": m.scheduled_date.isoformat(), "status": m.status} for m in recent_maintenance],
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        system_instruction = (
            "You are an expert industrial reliability engineer. Analyze the provided measured telemetry evidence, "
            "active alerts, and equipment history. Respond ONLY with valid JSON conforming to: "
            "{ observations_summary: string, possible_causes: string[], suggested_checks: [{check_name: string, subsystem: string, procedure: string, priority: string}], recommended_actions: string[], uncertainty_and_limitations: string, risk_level: string }. "
            "Never invent measurements that are not in the payload. Distinguish measured facts from hypothetical failure modes."
        )

        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": f"{system_instruction}\n\nEvidence JSON:\n{json.dumps(prompt_payload)}"}], "role": "user"}]
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                # Clean markdown code block if present
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                parsed = json.loads(raw_text)

                checks = [
                    DiagnosticCheck(
                        check_name=c.get("check_name", "Inspection"),
                        subsystem=c.get("subsystem", "Mechanical"),
                        procedure=c.get("procedure", "Inspect equipment"),
                        priority=c.get("priority", "High")
                    )
                    for c in parsed.get("suggested_checks", [])
                ]

                return DiagnosticReport(
                    equipment_id=equipment.id,
                    equipment_code=equipment.equipment_code,
                    equipment_name=equipment.name,
                    generated_at=now,
                    engine_used="Gemini Industrial Diagnostic LLM",
                    observations_summary=parsed.get("observations_summary", "Synthesis complete."),
                    measured_evidence=measured_evidence,
                    possible_causes=parsed.get("possible_causes", []),
                    suggested_checks=checks,
                    recommended_actions=parsed.get("recommended_actions", []),
                    uncertainty_and_limitations=parsed.get("uncertainty_and_limitations", "LLM synthesized inference. Requires physical verification."),
                    risk_level=parsed.get("risk_level", "Moderate"),
                )
        return None
