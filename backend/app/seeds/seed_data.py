import datetime
import random
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.models.alert import Alert, AlertRule
from app.models.maintenance import MaintenanceRecord
from app.services.auth_service import get_password_hash
from app.ml.anomaly_detector import detector


def seed_database(db: Session = None):
    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True

    try:
        # 1. Seed Users (Admin, Engineer, Viewer)
        users_data = [
            {
                "email": "admin@intellimaintain.io",
                "full_name": "Eleanor Vance (Plant Admin)",
                "role": "admin",
                "password": "AdminPass123!",
            },
            {
                "email": "engineer@intellimaintain.io",
                "full_name": "Marcus Kane (Reliability Engineer)",
                "role": "engineer",
                "password": "EngineerPass123!",
            },
            {
                "email": "viewer@intellimaintain.io",
                "full_name": "Sarah Lin (Operations Viewer)",
                "role": "viewer",
                "password": "ViewerPass123!",
            },
        ]

        for u in users_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                db_user = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    role=u["role"],
                    hashed_password=get_password_hash(u["password"]),
                    is_active=True,
                )
                db.add(db_user)
        db.commit()

        # 2. Seed Equipment
        equipment_data = [
            {
                "equipment_code": "PUMP-101",
                "name": "Primary Cooling Water Centrifugal Pump",
                "equipment_type": "pump",
                "location": "Utility Bay 1 - Floor B",
                "description": "Continuous duty cooling circulation pump supporting primary heat exchangers.",
                "operational_status": "operational",
                "installation_date": datetime.datetime(2021, 3, 15),
                "sensor_thresholds": {
                    "temp_warn": 75.0, "temp_crit": 90.0,
                    "vib_warn": 4.5, "vib_crit": 7.1,
                    "press_min": 2.0, "press_max": 6.5,
                    "current_max": 38.0, "rpm_min": 1420, "rpm_max": 1540
                }
            },
            {
                "equipment_code": "COMP-204",
                "name": "High-Pressure Rotary Screw Air Compressor",
                "equipment_type": "compressor",
                "location": "Compressor Room A - Cell 3",
                "description": "Supplies pneumatic air headers across fabrication and packaging cells.",
                "operational_status": "warning",
                "installation_date": datetime.datetime(2020, 8, 20),
                "sensor_thresholds": {
                    "temp_warn": 82.0, "temp_crit": 95.0,
                    "vib_warn": 5.0, "vib_crit": 8.0,
                    "press_min": 6.0, "press_max": 10.5,
                    "current_max": 55.0, "rpm_min": 2900, "rpm_max": 3100
                }
            },
            {
                "equipment_code": "MTR-305",
                "name": "Extruder Main Drive 3-Phase Induction Motor",
                "equipment_type": "motor",
                "location": "Extrusion Line 2",
                "description": "Variable-speed 75kW induction motor driving main screw extruder.",
                "operational_status": "operational",
                "installation_date": datetime.datetime(2022, 1, 10),
                "sensor_thresholds": {
                    "temp_warn": 70.0, "temp_crit": 85.0,
                    "vib_warn": 3.8, "vib_crit": 6.5,
                    "press_min": 1.0, "press_max": 5.0,
                    "current_max": 45.0, "rpm_min": 1400, "rpm_max": 1600
                }
            },
            {
                "equipment_code": "FAN-412",
                "name": "Cooling Tower Induced Draft Axial Fan",
                "equipment_type": "fan",
                "location": "Rooftop Cooling Deck 4",
                "description": "Large-diameter axial fan exhausting cooling tower air; subject to weather and blade fouling.",
                "operational_status": "critical",
                "installation_date": datetime.datetime(2019, 11, 5),
                "sensor_thresholds": {
                    "temp_warn": 72.0, "temp_crit": 88.0,
                    "vib_warn": 4.5, "vib_crit": 7.0,
                    "press_min": 0.5, "press_max": 3.0,
                    "current_max": 32.0, "rpm_min": 850, "rpm_max": 950
                }
            },
            {
                "equipment_code": "HYD-502",
                "name": "Heavy-Duty Hydraulic Forging Press",
                "equipment_type": "hydraulic_press",
                "location": "Forming Hall - Bay C",
                "description": "500-ton hydraulic stamping press operating cyclic load profiles.",
                "operational_status": "operational",
                "installation_date": datetime.datetime(2018, 6, 25),
                "sensor_thresholds": {
                    "temp_warn": 65.0, "temp_crit": 80.0,
                    "vib_warn": 3.5, "vib_crit": 6.0,
                    "press_min": 15.0, "press_max": 45.0,
                    "current_max": 60.0, "rpm_min": None, "rpm_max": None
                }
            },
            {
                "equipment_code": "TURB-601",
                "name": "Multi-Stage Steam Boiler Feed Turbine",
                "equipment_type": "turbine",
                "location": "Cogeneration Plant - Turbine Hall",
                "description": "High-reliability steam-driven feedwater injection unit for steam boilers.",
                "operational_status": "operational",
                "installation_date": datetime.datetime(2017, 9, 12),
                "sensor_thresholds": {
                    "temp_warn": 85.0, "temp_crit": 105.0,
                    "vib_warn": 3.0, "vib_crit": 5.5,
                    "press_min": 25.0, "press_max": 65.0,
                    "current_max": 25.0, "rpm_min": 3500, "rpm_max": 3700
                }
            },
        ]

        created_equipment = []
        for eq_spec in equipment_data:
            existing = db.query(Equipment).filter(Equipment.equipment_code == eq_spec["equipment_code"]).first()
            if not existing:
                eq = Equipment(**eq_spec)
                db.add(eq)
                db.commit()
                db.refresh(eq)
                created_equipment.append(eq)
            else:
                created_equipment.append(existing)

        # 3. Seed Realistic Historical Telemetry (Past 48 Hours)
        now = datetime.datetime.utcnow()
        telemetry_count = db.query(Telemetry).count()

        if telemetry_count < 100:
            random.seed(42)
            for eq in created_equipment:
                # Base nominal parameters per equipment type
                is_fan = eq.equipment_code == "FAN-412"
                is_comp = eq.equipment_code == "COMP-204"

                # Generate 40 readings stepping backward in time (approx every 1 hour)
                for step in range(40, -1, -1):
                    t_time = now - datetime.timedelta(hours=step, minutes=random.randint(0, 15))

                    if is_fan:
                        # FAN-412: Degraded, showing heavy unbalance vibration and overheating in the last 10 hours
                        if step <= 10:
                            temp = 89.5 + random.uniform(-1.0, 3.0)  # Critical
                            vib = 7.8 + random.uniform(-0.3, 1.2)   # Critical
                            press = 1.2 + random.uniform(-0.1, 0.1)
                            curr = 31.0 + random.uniform(-1.0, 2.5)
                            rpm = 880.0 + random.uniform(-10, 10)
                        else:
                            temp = 68.0 + random.uniform(-2.0, 2.0)
                            vib = 3.8 + random.uniform(-0.4, 0.4)
                            press = 1.4 + random.uniform(-0.1, 0.1)
                            curr = 24.0 + random.uniform(-1.0, 1.0)
                            rpm = 910.0 + random.uniform(-5, 5)

                    elif is_comp:
                        # COMP-204: Elevated vibration warning
                        temp = 79.0 + random.uniform(-1.5, 2.5)
                        vib = 5.4 + random.uniform(-0.3, 0.5)  # Warning
                        press = 7.8 + random.uniform(-0.3, 0.3)
                        curr = 44.0 + random.uniform(-1.5, 1.5)
                        rpm = 2980.0 + random.uniform(-15, 15)

                    else:
                        # Nominal equipment
                        temp = 54.0 + random.uniform(-2.0, 2.0)
                        vib = 2.1 + random.uniform(-0.3, 0.3)
                        press = 3.4 + random.uniform(-0.2, 0.2) if eq.equipment_type != "hydraulic_press" else 28.0 + random.uniform(-1.0, 1.0)
                        curr = 22.0 + random.uniform(-1.0, 1.0)
                        rpm = 1485.0 + random.uniform(-10, 10)

                    reading_dict = {
                        "temperature": round(temp, 2),
                        "vibration": round(vib, 3),
                        "pressure": round(press, 2),
                        "motor_current": round(curr, 2),
                        "speed_rpm": round(rpm, 1),
                    }
                    is_anom, anom_score, _ = detector.score_reading(reading_dict)

                    t = Telemetry(
                        equipment_id=eq.id,
                        timestamp=t_time,
                        temperature=reading_dict["temperature"],
                        vibration=reading_dict["vibration"],
                        pressure=reading_dict["pressure"],
                        motor_current=reading_dict["motor_current"],
                        speed_rpm=reading_dict["speed_rpm"],
                        sensor_quality="good",
                        is_anomaly=is_anom,
                        anomaly_score=anom_score,
                    )
                    db.add(t)

            db.commit()

        # 4. Seed Alerts
        alert_count = db.query(Alert).count()
        if alert_count == 0:
            fan_eq = next((e for e in created_equipment if e.equipment_code == "FAN-412"), created_equipment[0])
            comp_eq = next((e for e in created_equipment if e.equipment_code == "COMP-204"), created_equipment[1])
            pump_eq = next((e for e in created_equipment if e.equipment_code == "PUMP-101"), created_equipment[0])

            alerts_to_seed = [
                # Open critical alert on FAN-412
                Alert(
                    equipment_id=fan_eq.id,
                    alert_type="threshold_violation",
                    severity="critical",
                    title=f"Severe Mechanical Vibration on {fan_eq.equipment_code}",
                    description="Vibration velocity 8.2 mm/s RMS exceeds ISO 10816 Zone D boundary (7.0 mm/s). Imminent bearing structural failure.",
                    triggering_measurement={"metric": "vibration", "value": 8.2, "unit": "mm/s RMS", "threshold": 7.0},
                    detection_reason="ISO 10816 Zone D threshold breach",
                    cooldown_key=f"eq-{fan_eq.id}:vib:critical",
                    status="open",
                    timestamp=now - datetime.timedelta(hours=2),
                ),
                # Open critical alert on FAN-412 (Temperature)
                Alert(
                    equipment_id=fan_eq.id,
                    alert_type="threshold_violation",
                    severity="critical",
                    title=f"Critical Overheating on {fan_eq.equipment_code}",
                    description="Axial fan motor bearing temperature reached 91.2°C exceeding critical limit of 88.0°C.",
                    triggering_measurement={"metric": "temperature", "value": 91.2, "unit": "°C", "threshold": 88.0},
                    detection_reason="Bearing temperature exceeded 88.0°C",
                    cooldown_key=f"eq-{fan_eq.id}:temp:critical",
                    status="open",
                    timestamp=now - datetime.timedelta(hours=1, minutes=45),
                ),
                # Acknowledged alert on COMP-204
                Alert(
                    equipment_id=comp_eq.id,
                    alert_type="threshold_violation",
                    severity="medium",
                    title=f"Elevated Vibration on {comp_eq.equipment_code}",
                    description="Screw compressor vibration 5.4 mm/s RMS exceeds advisory threshold 5.0 mm/s.",
                    triggering_measurement={"metric": "vibration", "value": 5.4, "unit": "mm/s RMS", "threshold": 5.0},
                    detection_reason="Advisory vibration warning limit reached",
                    cooldown_key=f"eq-{comp_eq.id}:vib:warning",
                    status="acknowledged",
                    acknowledged_at=now - datetime.timedelta(hours=5),
                    acknowledged_by="Marcus Kane (Reliability Engineer)",
                    timestamp=now - datetime.timedelta(hours=8),
                ),
                # Resolved alert on PUMP-101
                Alert(
                    equipment_id=pump_eq.id,
                    alert_type="threshold_violation",
                    severity="high",
                    title=f"High Temperature Warning on {pump_eq.equipment_code}",
                    description="Transient temperature peak of 78.5°C during discharge valve throttle test.",
                    triggering_measurement={"metric": "temperature", "value": 78.5, "unit": "°C", "threshold": 75.0},
                    detection_reason="Discharge throttle test heat soak",
                    cooldown_key=f"eq-{pump_eq.id}:temp:warning",
                    status="resolved",
                    acknowledged_at=now - datetime.timedelta(days=1),
                    acknowledged_by="Marcus Kane",
                    resolved_at=now - datetime.timedelta(hours=20),
                    resolved_by="Eleanor Vance",
                    resolution_notes="Transient temperature normalized after valve reopening; cooling jacket flow confirmed at 42 LPM.",
                    timestamp=now - datetime.timedelta(days=1, hours=2),
                ),
            ]
            for a in alerts_to_seed:
                db.add(a)
            db.commit()

        # 5. Seed Maintenance Records
        maint_count = db.query(MaintenanceRecord).count()
        if maint_count == 0:
            fan_eq = next((e for e in created_equipment if e.equipment_code == "FAN-412"), created_equipment[0])
            comp_eq = next((e for e in created_equipment if e.equipment_code == "COMP-204"), created_equipment[1])
            pump_eq = next((e for e in created_equipment if e.equipment_code == "PUMP-101"), created_equipment[0])

            maint_to_seed = [
                # Overdue maintenance
                MaintenanceRecord(
                    equipment_id=comp_eq.id,
                    title="Rotary Screw Air Filter & Oil Separator Cartridge Replacement",
                    description="Scheduled 2,000-hour preventive servicing of intake filters and synthetic lubricant top-off.",
                    maintenance_type="preventive",
                    priority="high",
                    status="scheduled",
                    scheduled_date=now - datetime.timedelta(days=2),
                    assigned_technician="Dave Kowalski",
                    work_performed=None,
                    parts_used="Air filter cartridge (OEM #AF-402), synthetic screw compressor oil (20L)",
                    notes="Awaiting shutdown window approval from production dispatch.",
                ),
                # Upcoming maintenance
                MaintenanceRecord(
                    equipment_id=pump_eq.id,
                    title="Quarterly Mechanical Seal & Bearing Lubrication Inspection",
                    description="Check mechanical seal flushing flush plan 11 and grease non-drive end ball bearings.",
                    maintenance_type="inspection",
                    priority="medium",
                    status="scheduled",
                    scheduled_date=now + datetime.timedelta(days=3),
                    assigned_technician="Marcus Kane",
                    work_performed=None,
                    parts_used="Polyurea EP2 bearing grease (400g)",
                    notes="Perform dynamic vibration survey during runup.",
                ),
                # Emergency upcoming work on FAN-412
                MaintenanceRecord(
                    equipment_id=fan_eq.id,
                    title="Emergency Blade Unbalance Correction & Pillow Block Bearing Inspection",
                    description="Correct high vibration triggered by ISO Zone D alarm. Clean fan blade deposits and inspect spherical roller bearing.",
                    maintenance_type="emergency",
                    priority="critical",
                    status="scheduled",
                    scheduled_date=now + datetime.timedelta(hours=6),
                    assigned_technician="Marcus Kane & Outside Service Contractor",
                    parts_used="SKF 22216 EK spherical roller bearing kit, dynamic balance clip weights",
                    notes="Lockout/Tagout permit #LOTO-8841 already signed off by safety coordinator.",
                ),
                # Completed historical record
                MaintenanceRecord(
                    equipment_id=pump_eq.id,
                    title="Annual Pump Coupling Alignment & Impeller Clearance Check",
                    description="Laser alignment check between induction motor and centrifugal pump shaft.",
                    maintenance_type="preventive",
                    priority="medium",
                    status="completed",
                    scheduled_date=now - datetime.timedelta(days=25),
                    completion_date=now - datetime.timedelta(days=25, hours=-2),
                    assigned_technician="Dave Kowalski",
                    work_performed="Aligned shaft to within 0.03mm angular and radial offset using Easy-Laser system. Tightened foundation bolts to 180 Nm.",
                    parts_used="Stainless steel shim pack 0.05mm - 0.5mm",
                    notes="Baseline vibration dropped from 3.1 mm/s to 1.9 mm/s after precision alignment.",
                ),
            ]
            for m in maint_to_seed:
                db.add(m)
            db.commit()

        return {
            "users": db.query(User).count(),
            "equipment": db.query(Equipment).count(),
            "telemetry": db.query(Telemetry).count(),
            "alerts": db.query(Alert).count(),
            "maintenance": db.query(MaintenanceRecord).count(),
        }

    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    result = seed_database()
    print("Seed complete:", result)
