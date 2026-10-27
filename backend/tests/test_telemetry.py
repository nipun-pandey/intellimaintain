def test_ingest_telemetry_valid(client, engineer_headers):
    payload = {
        "equipment_id": 1,
        "temperature": 62.4,
        "vibration": 2.15,
        "pressure": 3.4,
        "motor_current": 22.1,
        "speed_rpm": 1490.0,
        "sensor_quality": "good",
    }
    response = client.post("/api/v1/telemetry/ingest", json=payload, headers=engineer_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["equipment_id"] == 1
    assert data["temperature"] == 62.4
    assert data["vibration"] == 2.15
    assert "is_anomaly" in data
    assert "anomaly_score" in data


def test_ingest_telemetry_invalid_bounds(client, engineer_headers):
    # Unrealistic negative vibration
    payload = {
        "equipment_id": 1,
        "temperature": 60.0,
        "vibration": -5.0,  # Invalid
        "pressure": 3.0,
        "motor_current": 20.0,
    }
    response = client.post("/api/v1/telemetry/ingest", json=payload, headers=engineer_headers)
    assert response.status_code == 422


def test_batch_ingest(client, engineer_headers):
    payload = {
        "readings": [
            {
                "equipment_id": 1,
                "temperature": 55.0,
                "vibration": 1.8,
                "pressure": 3.1,
                "motor_current": 19.5,
            },
            {
                "equipment_id": 1,
                "temperature": 56.1,
                "vibration": 1.9,
                "pressure": 3.2,
                "motor_current": 20.0,
            }
        ]
    }
    response = client.post("/api/v1/telemetry/batch", json=payload, headers=engineer_headers)
    assert response.status_code == 201
    assert response.json()["ingested_count"] == 2


def test_get_recent_readings(client, engineer_headers):
    response = client.get("/api/v1/telemetry/equipment/1/recent?limit=10", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_aggregated_readings(client, engineer_headers):
    response = client.get("/api/v1/telemetry/equipment/1/aggregate?period=24h", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert "points" in data
    assert data["equipment_id"] == 1
