from app.services.health_service import EquipmentHealthService
from app.models.equipment import Equipment


def test_equipment_health_scoring(client, engineer_headers, db_session):
    eq = db_session.query(Equipment).filter(Equipment.equipment_code == "FAN-412").first()
    assert eq is not None

    service = EquipmentHealthService(db_session)
    health = service.calculate_health(eq)

    assert health.equipment_code == "FAN-412"
    assert 0.0 <= health.health_score <= 100.0
    assert health.health_category in ["Good", "Fair", "Poor", "Critical", "Stale / Inconclusive"]
    assert len(health.contributing_factors) > 0


def test_health_api_endpoint(client, engineer_headers):
    response = client.get("/api/v1/health/equipment/1", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert "health_score" in data
    assert "health_category" in data
    assert "telemetry_status" in data
    assert "contributing_factors" in data
