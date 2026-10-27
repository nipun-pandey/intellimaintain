import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_
from app.database import get_db
from app.models.equipment import Equipment
from app.models.telemetry import Telemetry
from app.schemas.telemetry import (
    TelemetryCreate,
    TelemetryBatchCreate,
    TelemetryResponse,
    TelemetryAggregateResponse,
    TelemetryAggregatedPoint,
)
from app.services.alert_engine import AlertEngine
from app.ml.anomaly_detector import detector
from app.api.deps import get_current_user

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.post("/ingest", response_model=TelemetryResponse, status_code=status.HTTP_201_CREATED)
def ingest_telemetry_reading(
    reading_in: TelemetryCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Ingest a single industrial telemetry record.
    Evaluates ML Isolation Forest anomaly scores and tests against equipment alarm rules.
    """
    eq = db.query(Equipment).filter(Equipment.id == reading_in.equipment_id).first()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment with ID {reading_in.equipment_id} not found",
        )

    # 1. Run Machine Learning Anomaly Detection
    reading_dict = reading_in.model_dump()
    is_anomaly, score, _ = detector.score_reading(reading_dict)

    # 2. Get previous reading for rate of change calculation
    prev = db.query(Telemetry).filter(
        Telemetry.equipment_id == eq.id
    ).order_by(desc(Telemetry.timestamp)).first()

    # 3. Create telemetry record
    reading_time = reading_in.timestamp or datetime.datetime.utcnow()
    telemetry = Telemetry(
        equipment_id=reading_in.equipment_id,
        timestamp=reading_time,
        temperature=reading_in.temperature,
        vibration=reading_in.vibration,
        pressure=reading_in.pressure,
        motor_current=reading_in.motor_current,
        speed_rpm=reading_in.speed_rpm,
        sensor_quality=reading_in.sensor_quality,
        metadata_json=reading_in.metadata_json,
        is_anomaly=is_anomaly,
        anomaly_score=score,
    )
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)

    # 4. Run Alert Rule Engine
    alert_engine = AlertEngine(db)
    alert_engine.evaluate_telemetry_reading(eq, telemetry, prev)

    return telemetry


@router.post("/batch", status_code=status.HTTP_201_CREATED)
def ingest_telemetry_batch(
    batch_in: TelemetryBatchCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Ingest a batch of historical or buffered edge telemetry readings."""
    if not batch_in.readings:
        return {"ingested_count": 0, "message": "No readings provided"}

    ingested = 0
    alert_engine = AlertEngine(db)

    for reading_in in batch_in.readings:
        eq = db.query(Equipment).filter(Equipment.id == reading_in.equipment_id).first()
        if not eq:
            continue

        reading_dict = reading_in.model_dump()
        is_anomaly, score, _ = detector.score_reading(reading_dict)

        reading_time = reading_in.timestamp or datetime.datetime.utcnow()
        telemetry = Telemetry(
            equipment_id=reading_in.equipment_id,
            timestamp=reading_time,
            temperature=reading_in.temperature,
            vibration=reading_in.vibration,
            pressure=reading_in.pressure,
            motor_current=reading_in.motor_current,
            speed_rpm=reading_in.speed_rpm,
            sensor_quality=reading_in.sensor_quality,
            metadata_json=reading_in.metadata_json,
            is_anomaly=is_anomaly,
            anomaly_score=score,
        )
        db.add(telemetry)
        db.commit()
        db.refresh(telemetry)
        alert_engine.evaluate_telemetry_reading(eq, telemetry)
        ingested += 1

    return {"ingested_count": ingested, "status": "success"}


@router.get("/equipment/{equipment_id}/recent", response_model=List[TelemetryResponse])
def get_recent_readings(
    equipment_id: int,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve most recent telemetry records for real-time live monitoring."""
    readings = db.query(Telemetry).filter(
        Telemetry.equipment_id == equipment_id
    ).order_by(desc(Telemetry.timestamp)).limit(limit).all()

    # Return chronological order (oldest to newest for charting)
    return list(reversed(readings))


@router.get("/equipment/{equipment_id}/history", response_model=List[TelemetryResponse])
def get_historical_readings(
    equipment_id: int,
    start_time: Optional[datetime.datetime] = Query(None),
    end_time: Optional[datetime.datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Query paginated historical telemetry with optional time-range bounds."""
    query = db.query(Telemetry).filter(Telemetry.equipment_id == equipment_id)

    if start_time:
        query = query.filter(Telemetry.timestamp >= start_time)
    if end_time:
        query = query.filter(Telemetry.timestamp <= end_time)

    return query.order_by(desc(Telemetry.timestamp)).offset(skip).limit(limit).all()


@router.get("/latest", response_model=Dict[int, TelemetryResponse])
def get_latest_telemetry_all_equipment(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve the single most recent telemetry packet for each equipment item."""
    equipments = db.query(Equipment).filter(Equipment.is_archived == False).all()
    latest_map = {}

    for eq in equipments:
        latest = db.query(Telemetry).filter(
            Telemetry.equipment_id == eq.id
        ).order_by(desc(Telemetry.timestamp)).first()
        if latest:
            latest_map[eq.id] = TelemetryResponse.model_validate(latest)

    return latest_map


@router.get("/equipment/{equipment_id}/aggregate", response_model=TelemetryAggregateResponse)
def get_aggregated_telemetry(
    equipment_id: int,
    period: str = Query("24h", description="Aggregation window: 1h, 6h, 24h, 7d"),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """Retrieve downsampled aggregated telemetry buckets suitable for dense multi-day trends."""
    now = datetime.datetime.utcnow()
    if period == "1h":
        start_time = now - datetime.timedelta(hours=1)
        bucket_count = 12  # 5-min intervals
    elif period == "6h":
        start_time = now - datetime.timedelta(hours=6)
        bucket_count = 24  # 15-min intervals
    elif period == "7d":
        start_time = now - datetime.timedelta(days=7)
        bucket_count = 28  # 6-hour intervals
    else:  # default 24h
        start_time = now - datetime.timedelta(hours=24)
        bucket_count = 24  # 1-hour intervals

    readings = db.query(Telemetry).filter(
        Telemetry.equipment_id == equipment_id,
        Telemetry.timestamp >= start_time
    ).order_by(Telemetry.timestamp.asc()).all()

    if not readings:
        return TelemetryAggregateResponse(equipment_id=equipment_id, period=period, points=[])

    # Downsample in Python for maximum dialect portability (works across Postgres and SQLite)
    chunk_size = max(1, len(readings) // bucket_count)
    points: List[TelemetryAggregatedPoint] = []

    for i in range(0, len(readings), chunk_size):
        chunk = readings[i:i + chunk_size]
        avg_temp = sum(r.temperature for r in chunk) / len(chunk)
        max_temp = max(r.temperature for r in chunk)
        avg_vib = sum(r.vibration for r in chunk) / len(chunk)
        max_vib = max(r.vibration for r in chunk)
        avg_press = sum(r.pressure for r in chunk) / len(chunk)
        avg_curr = sum(r.motor_current for r in chunk) / len(chunk)
        anomalies = sum(1 for r in chunk if r.is_anomaly)

        points.append(TelemetryAggregatedPoint(
            bucket_time=chunk[-1].timestamp.strftime("%H:%M" if period in ["1h", "6h", "24h"] else "%b %d %H:%M"),
            avg_temperature=round(avg_temp, 2),
            max_temperature=round(max_temp, 2),
            avg_vibration=round(avg_vib, 3),
            max_vibration=round(max_vib, 3),
            avg_pressure=round(avg_press, 2),
            avg_current=round(avg_curr, 2),
            reading_count=len(chunk),
            anomaly_count=anomalies,
        ))

    return TelemetryAggregateResponse(
        equipment_id=equipment_id,
        period=period,
        points=points,
    )
