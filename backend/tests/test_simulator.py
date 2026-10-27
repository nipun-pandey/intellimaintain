def test_simulator_status_and_lifecycle(client, engineer_headers):
    # 1. Check initial status
    status_resp = client.get("/api/v1/simulator/status", headers=engineer_headers)
    assert status_resp.status_code == 200

    # 2. Start simulation
    start_resp = client.post(
        "/api/v1/simulator/start",
        json={"equipment_id": 1, "scenario": "normal", "interval_seconds": 1.0},
        headers=engineer_headers
    )
    assert start_resp.status_code == 200
    data = start_resp.json()
    assert data["is_running"] is True
    assert data["equipment_id"] == 1
    assert data["scenario"] == "normal"

    # 3. Stop simulation
    stop_resp = client.post("/api/v1/simulator/stop", headers=engineer_headers)
    assert stop_resp.status_code == 200
    assert stop_resp.json()["is_running"] is False

    # 4. Reset simulation
    reset_resp = client.post("/api/v1/simulator/reset", headers=engineer_headers)
    assert reset_resp.status_code == 200
    assert reset_resp.json()["readings_generated"] == 0


def test_simulator_viewer_forbidden(client, viewer_headers):
    resp = client.post(
        "/api/v1/simulator/start",
        json={"equipment_id": 1, "scenario": "anomaly", "interval_seconds": 1.0},
        headers=viewer_headers
    )
    assert resp.status_code == 403
