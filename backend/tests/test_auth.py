import pytest
from starlette.testclient import TestClient


def test_signup_success(client: TestClient):
    resp = client.post("/api/auth/signup", json={"email": "test@example.com", "password": "securepass"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "hashed_password" not in data


def test_signup_duplicate_email(client: TestClient):
    payload = {"email": "dup@example.com", "password": "securepass"}
    client.post("/api/auth/signup", json=payload)
    resp = client.post("/api/auth/signup", json=payload)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


def test_signup_invalid_email(client: TestClient):
    resp = client.post("/api/auth/signup", json={"email": "not-an-email", "password": "securepass"})
    assert resp.status_code == 422


def test_signup_short_password(client: TestClient):
    resp = client.post("/api/auth/signup", json={"email": "short@example.com", "password": "abc"})
    assert resp.status_code == 422


def test_login_success(client: TestClient):
    client.post("/api/auth/signup", json={"email": "login@example.com", "password": "mypassword"})
    resp = client.post("/api/auth/token", data={"username": "login@example.com", "password": "mypassword"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient):
    client.post("/api/auth/signup", json={"email": "wrong@example.com", "password": "correctpass"})
    resp = client.post("/api/auth/token", data={"username": "wrong@example.com", "password": "wrongpass"})
    assert resp.status_code == 400


def test_login_nonexistent_user(client: TestClient):
    resp = client.post("/api/auth/token", data={"username": "nobody@example.com", "password": "pass"})
    assert resp.status_code == 400
