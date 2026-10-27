def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin@intellimaintain.io", "password": "AdminPass123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@intellimaintain.io"
    assert data["user"]["role"] == "admin"


def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin@intellimaintain.io", "password": "WrongPassword!"}
    )
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent@intellimaintain.io", "password": "AnyPassword123!"}
    )
    assert response.status_code == 401


def test_get_current_user(client, engineer_headers):
    response = client.get("/api/v1/auth/me", headers=engineer_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "engineer@intellimaintain.io"
    assert data["role"] == "engineer"


def test_register_new_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "technician_1@intellimaintain.io",
            "full_name": "Tom Hayes",
            "role": "engineer",
            "password": "SecurePassword123!",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "technician_1@intellimaintain.io"
    assert data["role"] == "engineer"
