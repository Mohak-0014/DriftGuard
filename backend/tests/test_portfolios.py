import pytest
from starlette.testclient import TestClient


def _auth_headers(client: TestClient, email: str = "port@example.com", password: str = "testpass1") -> dict:
    client.post("/api/auth/signup", json={"email": email, "password": password})
    resp = client.post("/api/auth/token", data={"username": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_portfolio(client: TestClient):
    headers = _auth_headers(client)
    resp = client.post("/api/portfolios/", json={"name": "My Portfolio", "currency": "USD"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Portfolio"
    assert data["holdings"] == []


def test_list_portfolios(client: TestClient):
    headers = _auth_headers(client, "list@example.com", "testpass2")
    client.post("/api/portfolios/", json={"name": "P1"}, headers=headers)
    client.post("/api/portfolios/", json={"name": "P2"}, headers=headers)
    resp = client.get("/api/portfolios/", headers=headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "P1" in names and "P2" in names


def test_get_portfolio_not_found(client: TestClient):
    headers = _auth_headers(client, "notfound@example.com", "testpass3")
    resp = client.get("/api/portfolios/9999", headers=headers)
    assert resp.status_code == 404


def test_add_holding_invalid_ticker(client: TestClient):
    headers = _auth_headers(client, "ticker@example.com", "testpass4")
    port = client.post("/api/portfolios/", json={"name": "T"}, headers=headers).json()
    resp = client.post(
        f"/api/portfolios/{port['id']}/holdings",
        json={"ticker": "invalid ticker!", "quantity": 10, "avg_price": 100},
        headers=headers,
    )
    assert resp.status_code == 422


def test_add_holding_negative_quantity(client: TestClient):
    headers = _auth_headers(client, "qty@example.com", "testpass5")
    port = client.post("/api/portfolios/", json={"name": "T"}, headers=headers).json()
    resp = client.post(
        f"/api/portfolios/{port['id']}/holdings",
        json={"ticker": "AAPL", "quantity": -5, "avg_price": 100},
        headers=headers,
    )
    assert resp.status_code == 422


def test_portfolios_isolated_between_users(client: TestClient):
    h1 = _auth_headers(client, "user1@example.com", "testpass6")
    h2 = _auth_headers(client, "user2@example.com", "testpass7")
    port = client.post("/api/portfolios/", json={"name": "Secret"}, headers=h1).json()
    resp = client.get(f"/api/portfolios/{port['id']}", headers=h2)
    assert resp.status_code == 404


def test_unauthenticated_access(client: TestClient):
    resp = client.get("/api/portfolios/")
    assert resp.status_code == 401
