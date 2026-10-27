def test_diagnostics_rule_based_fallback(client, engineer_headers):
    # Equipment 4 is FAN-412 which has critical alarms seeded
    response = client.get("/api/v1/diagnostics/equipment/4", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["equipment_code"] == "FAN-412"
    assert data["engine_used"] == "Deterministic Rule-Based Expert System"
    assert len(data["observations_summary"]) > 0
    assert len(data["possible_causes"]) > 0
    assert len(data["suggested_checks"]) > 0
    assert len(data["recommended_actions"]) > 0
    assert len(data["uncertainty_and_limitations"]) > 0
    assert len(data["measured_evidence"]) > 0

    # Verify structured checks have all required industrial fields
    check = data["suggested_checks"][0]
    assert "check_name" in check
    assert "subsystem" in check
    assert "procedure" in check
    assert "priority" in check


def test_diagnostics_nominal_equipment(client, engineer_headers):
    # Equipment 1 is PUMP-101 (nominal)
    response = client.get("/api/v1/diagnostics/equipment/1", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] in ["Low", "Moderate", "Elevated", "Critical"]
