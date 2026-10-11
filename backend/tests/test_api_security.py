"""Tests for API Key authentication on protected REST endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)


def test_public_endpoints_accessible_without_key():
    """Given public endpoints (/health or /regions), When requested without API key,
    Then it returns HTTP 200."""
    res = client.get("/api/vpn/regions")
    assert res.status_code == 200


@patch.dict("os.environ", {"VPN_API_KEY": "supersecretkey123"})
def test_protected_endpoint_rejected_without_api_key():
    """Given VPN_API_KEY is configured, When calling a protected endpoint without X-API-Key,
    Then it returns HTTP 401 Unauthorized."""
    res = client.post("/api/vpn/start?region=ap-southeast-2")
    assert res.status_code == 401
    assert "Invalid or missing API key" in res.json().get("detail", "")


@patch.dict("os.environ", {"VPN_API_KEY": "supersecretkey123"})
@patch("routers.vpn.start_vpn_instance")
def test_protected_endpoint_accepted_with_valid_api_key(mock_start):
    """Given VPN_API_KEY is configured, When calling with matching X-API-Key header,
    Then the request is authorized."""
    mock_start.return_value = {
        "instance_id": "i-12345",
        "region": "ap-southeast-2",
        "state": "running",
    }
    res = client.post(
        "/api/vpn/start?region=ap-southeast-2",
        headers={"X-API-Key": "supersecretkey123"},
    )
    assert res.status_code == 200
    assert res.json()["instance_id"] == "i-12345"
