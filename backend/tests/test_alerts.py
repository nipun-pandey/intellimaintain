def test_list_alerts(client, engineer_headers):
    response = client.get("/api/v1/alerts", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(a["status"] == "open" for a in data)


def test_trigger_threshold_alert_and_deduplication(client, engineer_headers):
    # Ingest critical temperature exceeding 90°C on equipment 1
    payload = {
        "equipment_id": 1,
        "temperature": 96.5,  # Trigger critical alert
        "vibration": 2.2,
        "pressure": 3.2,
        "motor_current": 20.0,
    }
    r1 = client.post("/api/v1/telemetry/ingest", json=payload, headers=engineer_headers)
    assert r1.status_code == 201

    # Check that alert was created
    alerts_resp = client.get("/api/v1/alerts?equipment_id=1&severity=critical", headers=engineer_headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) >= 1
    latest_alert = alerts[0]
    assert latest_alert["severity"] == "critical"
    assert latest_alert["alert_type"] == "threshold_violation"

    # Ingest second identical reading immediately - cooldown should suppress duplicate alert
    r2 = client.post("/api/v1/telemetry/ingest", json=payload, headers=engineer_headers)
    assert r2.status_code == 201

    alerts_resp2 = client.get("/api/v1/alerts?equipment_id=1&severity=critical", headers=engineer_headers)
    # Count should NOT increase due to cooldown suppression
    assert len(alerts_resp2.json()) == len(alerts)


def test_acknowledge_and_resolve_alert(client, engineer_headers):
    # Get an open alert
    alerts = client.get("/api/v1/alerts?status=open", headers=engineer_headers).json()
    assert len(alerts) > 0
    target_id = alerts[0]["id"]

    # 1. Acknowledge
    ack_resp = client.post(
        f"/api/v1/alerts/{target_id}/acknowledge",
        json={"acknowledged_by": "Test Engineer"},
        headers=engineer_headers
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"

    # 2. Resolve
    res_resp = client.post(
        f"/api/v1/alerts/{target_id}/resolve",
        json={"resolved_by": "Test Engineer", "resolution_notes": "Cleaned air intake filter and verified normal temp."},
        headers=engineer_headers
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "resolved"
    assert res_resp.json()["resolution_notes"] == "Cleaned air intake filter and verified normal temp."
