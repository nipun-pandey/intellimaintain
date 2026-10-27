def test_list_equipment(client, engineer_headers):
    response = client.get("/api/v1/equipment", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 6
    codes = [e["equipment_code"] for e in data]
    assert "PUMP-101" in codes
    assert "FAN-412" in codes


def test_get_equipment_detail(client, engineer_headers):
    response = client.get("/api/v1/equipment/1", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["equipment_code"] == "PUMP-101"
    assert data["equipment_type"] == "pump"
    assert data["health_score"] is not None


def test_create_equipment_engineer(client, engineer_headers):
    payload = {
        "equipment_code": "CHILLER-901",
        "name": "Industrial Absorption Chiller Unit",
        "equipment_type": "chiller",
        "location": "HVAC Mechanical Plant - Room 4",
        "description": "500-ton capacity water-cooled chiller.",
        "operational_status": "operational",
        "sensor_thresholds": {
            "temp_warn": 80.0,
            "temp_crit": 95.0,
            "vib_warn": 4.0,
            "vib_crit": 7.0,
            "press_min": 2.0,
            "press_max": 8.0,
            "current_max": 40.0,
        }
    }
    response = client.post("/api/v1/equipment", json=payload, headers=engineer_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["equipment_code"] == "CHILLER-901"


def test_create_equipment_viewer_forbidden(client, viewer_headers):
    payload = {
        "equipment_code": "FORBIDDEN-01",
        "name": "Forbidden Asset",
        "equipment_type": "pump",
        "location": "Anywhere",
        "operational_status": "operational",
    }
    response = client.post("/api/v1/equipment", json=payload, headers=viewer_headers)
    assert response.status_code == 403


def test_archive_equipment_admin(client, admin_headers):
    response = client.delete("/api/v1/equipment/6", headers=admin_headers)
    assert response.status_code == 200
    # Confirm it is soft-archived
    resp2 = client.get("/api/v1/equipment/6", headers=admin_headers)
    assert resp2.json()["is_archived"] is True
