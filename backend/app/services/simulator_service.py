import asyncio
import datetime
import random
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.services.alert_engine import AlertEngine
from app.ml.anomaly_detector import detector
from app.schemas.simulator import SimulatorStatus


class TelemetrySimulatorManager:
    """
    Manages active asynchronous telemetry simulation tasks.
    Supports 5 realistic industrial scenarios and routes readings through the
    real database persistence, ML anomaly detection, and alert evaluation engine.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._equipment_id: Optional[int] = None
        self._scenario: str = "normal"
        self._interval_seconds: float = 2.0
        self._step_count: int = 0
        self._readings_generated: int = 0
        self._last_reading_time: Optional[str] = None
        self._recent_readings: List[Dict[str, Any]] = []
        self._stuck_value: Optional[Dict[str, float]] = None

    def get_status(self) -> SimulatorStatus:
        equipment_code = None
        if self._equipment_id:
            db = SessionLocal()
            try:
                eq = db.query(Equipment).filter(Equipment.id == self._equipment_id).first()
                if eq:
                    equipment_code = eq.equipment_code
            finally:
                db.close()

        status_msg = "Running" if self._is_running else "Stopped"
        if self._is_running and self._scenario == "communication_interruption":
            status_msg = "Running (Simulating drop/timeout)"

        return SimulatorStatus(
            is_running=self._is_running,
            equipment_id=self._equipment_id,
            equipment_code=equipment_code,
            scenario=self._scenario,
            interval_seconds=self._interval_seconds,
            readings_generated=self._readings_generated,
            current_step=self._step_count,
            last_reading_time=self._last_reading_time,
            status_message=status_msg,
        )

    def get_recent_readings(self) -> List[Dict[str, Any]]:
        return self._recent_readings[-20:]

    def start(self, equipment_id: int, scenario: str = "normal", interval_seconds: float = 2.0):
        if self._is_running:
            self.stop()

        self._equipment_id = equipment_id
        self._scenario = scenario
        self._interval_seconds = max(0.5, min(interval_seconds, 30.0))
        self._is_running = True
        self._step_count = 0
        self._stuck_value = None

        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._simulation_loop())
        except RuntimeError:
            self._task = None

    def stop(self):
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

    def reset(self):
        self.stop()
        self._step_count = 0
        self._readings_generated = 0
        self._last_reading_time = None
        self._recent_readings = []
        self._stuck_value = None

    async def _simulation_loop(self):
        while self._is_running and self._equipment_id:
            try:
                self._step_count += 1

                # Scenario 5: Communication interruption (Stop sending data to create stale condition)
                if self._scenario == "communication_interruption":
                    # Emit one reading then withhold further telemetry
                    if self._step_count > 1:
                        await asyncio.sleep(self._interval_seconds)
                        continue

                reading_data = self._generate_scenario_data(self._step_count)
                if reading_data:
                    # Ingest via database and alert engine
                    self._persist_and_evaluate(reading_data)

                await asyncio.sleep(self._interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Log error and continue safely without crashing server
                await asyncio.sleep(self._interval_seconds)

    def _generate_scenario_data(self, step: int) -> Optional[Dict[str, Any]]:
        # Base nominal operating parameters
        base_temp = 55.0 + random.uniform(-1.5, 1.5)
        base_vib = 2.2 + random.uniform(-0.3, 0.3)
        base_press = 3.2 + random.uniform(-0.15, 0.15)
        base_curr = 21.0 + random.uniform(-1.0, 1.0)
        base_rpm = 1485.0 + random.uniform(-5.0, 5.0)
        sensor_quality = "good"

        # Scenario 1: Normal operation
        if self._scenario == "normal":
            temp = base_temp
            vib = base_vib
            press = base_press
            curr = base_curr
            rpm = base_rpm

        # Scenario 2: Gradual deterioration (Progressive bearing wear and thermal rise)
        elif self._scenario == "deterioration":
            # Over 30 steps, ramp vibration from 2.2 to 8.5 mm/s and temperature from 55°C to 94°C
            progress = min(1.0, step / 30.0)
            temp = base_temp + (progress * 40.0) + random.uniform(-1.0, 1.0)
            vib = base_vib + (progress * 6.5) + random.uniform(-0.2, 0.2)
            press = base_press - (progress * 0.8) + random.uniform(-0.1, 0.1)
            curr = base_curr + (progress * 12.0) + random.uniform(-0.5, 0.5)
            rpm = base_rpm - (progress * 40.0)

        # Scenario 3: Sudden anomaly (Spike after step 3)
        elif self._scenario == "anomaly":
            if step >= 3:
                # Immediate severe thermal and vibration spike
                temp = base_temp + random.uniform(35.0, 45.0)  # > 90°C
                vib = base_vib + random.uniform(5.5, 8.0)      # > 7.7 mm/s
                press = base_press + random.uniform(2.5, 3.8)  # > 6.0 bar
                curr = base_curr + random.uniform(16.0, 22.0)  # > 38 A
                rpm = base_rpm - random.uniform(80.0, 120.0)
            else:
                temp = base_temp
                vib = base_vib
                press = base_press
                curr = base_curr
                rpm = base_rpm

        # Scenario 4: Sensor failure (Frozen value or corrupted / bad status)
        elif self._scenario == "sensor_failure":
            if not self._stuck_value:
                self._stuck_value = {
                    "temp": 99.9,
                    "vib": 0.0,
                    "press": 0.0,
                    "curr": 0.0,
                    "rpm": 0.0,
                }
            temp = self._stuck_value["temp"]
            vib = self._stuck_value["vib"]
            press = self._stuck_value["press"]
            curr = self._stuck_value["curr"]
            rpm = self._stuck_value["rpm"]
            sensor_quality = "bad"

        else:
            temp = base_temp
            vib = base_vib
            press = base_press
            curr = base_curr
            rpm = base_rpm

        return {
            "equipment_id": self._equipment_id,
            "timestamp": datetime.datetime.utcnow(),
            "temperature": round(temp, 2),
            "vibration": round(vib, 3),
            "pressure": round(press, 2),
            "motor_current": round(curr, 2),
            "speed_rpm": round(rpm, 1),
            "sensor_quality": sensor_quality,
            "metadata_json": {"scenario": self._scenario, "sim_step": step},
        }

    def _persist_and_evaluate(self, reading_data: Dict[str, Any]):
        db = SessionLocal()
        try:
            eq = db.query(Equipment).filter(Equipment.id == self._equipment_id).first()
            if not eq:
                return

            # Score reading with Isolation Forest ML
            is_anomaly, score, _ = detector.score_reading(reading_data)

            # Query last previous reading for rate-of-change detection
            prev = db.query(Telemetry).filter(
                Telemetry.equipment_id == eq.id
            ).order_by(Telemetry.timestamp.desc()).first()

            telemetry = Telemetry(
                equipment_id=eq.id,
                timestamp=reading_data["timestamp"],
                temperature=reading_data["temperature"],
                vibration=reading_data["vibration"],
                pressure=reading_data["pressure"],
                motor_current=reading_data["motor_current"],
                speed_rpm=reading_data["speed_rpm"],
                sensor_quality=reading_data["sensor_quality"],
                metadata_json=reading_data["metadata_json"],
                is_anomaly=is_anomaly,
                anomaly_score=score,
            )
            db.add(telemetry)
            db.commit()
            db.refresh(telemetry)

            # Run alert engine
            engine = AlertEngine(db)
            engine.evaluate_telemetry_reading(eq, telemetry, prev)

            self._readings_generated += 1
            self._last_reading_time = telemetry.timestamp.isoformat()

            record = {
                "id": telemetry.id,
                "timestamp": self._last_reading_time,
                "temperature": telemetry.temperature,
                "vibration": telemetry.vibration,
                "pressure": telemetry.pressure,
                "motor_current": telemetry.motor_current,
                "speed_rpm": telemetry.speed_rpm,
                "sensor_quality": telemetry.sensor_quality,
                "is_anomaly": is_anomaly,
                "anomaly_score": score,
            }
            self._recent_readings.append(record)
            if len(self._recent_readings) > 50:
                self._recent_readings.pop(0)

        finally:
            db.close()


simulator_manager = TelemetrySimulatorManager()
