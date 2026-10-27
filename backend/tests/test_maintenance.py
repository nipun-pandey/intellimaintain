import datetime


def test_list_maintenance(client, engineer_headers):
    response = client.get("/api/v1/maintenance", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_maintenance_filters(client, engineer_headers):
    overdue_resp = client.get("/api/v1/maintenance?status=overdue", headers=engineer_headers)
    assert overdue_resp.status_code == 200
    assert isinstance(overdue_resp.json(), list)

    upcoming_resp = client.get("/api/v1/maintenance?status=upcoming", headers=engineer_headers)
    assert upcoming_resp.status_code == 200
    assert isinstance(upcoming_resp.json(), list)


def test_create_and_complete_maintenance(client, engineer_headers):
    sched_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    payload = {
        "equipment_id": 1,
        "title": "Biannual Coupling Alignment Survey",
        "description": "Check coupling laser alignment and replace flexible element.",
        "maintenance_type": "preventive",
        "priority": "medium",
        "scheduled_date": sched_date,
        "assigned_technician": "Alex Mercer",
    }
    create_resp = client.post("/api/v1/maintenance", json=payload, headers=engineer_headers)
    assert create_resp.status_code == 201
    record = create_resp.json()
    assert record["status"] == "scheduled"
    rec_id = record["id"]

    # Complete maintenance
    complete_resp = client.post(
        f"/api/v1/maintenance/{rec_id}/complete",
        json={
            "work_performed": "Laser alignment completed; radial runout within 0.02 mm.",
            "parts_used": "Coupling spider element E-40",
            "notes": "Machine returned to operational service."
        },
        headers=engineer_headers
    )
    assert complete_resp.status_code == 200
    data = complete_resp.json()
    assert data["status"] == "completed"
    assert "Laser alignment completed" in data["work_performed"]
