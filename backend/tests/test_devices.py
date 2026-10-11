"""Tests for multi-device peer management and 5-device limit in AWS Global Router v1.2.0."""

import pytest
from unittest.mock import MagicMock, patch
from core.dynamodb import (
    get_or_create_region_peers,
    add_device_peer,
    delete_device_peer,
    MAX_DEVICES_PER_REGION,
)


def test_max_devices_limit_constant():
    """Given the system specifications, When checking the capacity, Then maximum devices must be 5."""
    assert MAX_DEVICES_PER_REGION == 5


@patch("core.dynamodb.get_dynamodb_resource")
def test_get_or_create_region_peers_generates_keys_if_none_exist(mock_get_dynamo):
    """Given no existing peers in DynamoDB, When requesting peers for a region,
    Then a new server keypair and default iPhone device must be created."""
    mock_table = MagicMock()
    mock_table.get_item.return_value = {}  # No item found
    mock_dynamo = MagicMock()
    mock_dynamo.Table.return_value = mock_table
    mock_get_dynamo.return_value = mock_dynamo

    peers = get_or_create_region_peers("ap-southeast-2")

    assert peers["region"] == "ap-southeast-2"
    assert "server" in peers
    assert "private_key" in peers["server"]
    assert "public_key" in peers["server"]
    assert len(peers["devices"]) >= 1
    assert peers["devices"][0]["ip"] == "10.8.0.2"


@patch("core.dynamodb.get_dynamodb_resource")
def test_add_device_peer_assigns_sequential_ip(mock_get_dynamo):
    """Given an existing region with 1 device, When adding a second device,
    Then it should receive slot 2 and IP 10.8.0.3."""
    initial_peers = {
        "parameters": "peers_ap-southeast-2",
        "region": "ap-southeast-2",
        "server": {"private_key": "srv_priv", "public_key": "srv_pub"},
        "devices": [
            {
                "id": "dev_1",
                "name": "Phone",
                "slot": 1,
                "ip": "10.8.0.2",
                "private_key": "priv1",
                "public_key": "pub1",
            }
        ],
    }
    mock_table = MagicMock()
    mock_table.get_item.return_value = {"Item": initial_peers}
    mock_dynamo = MagicMock()
    mock_dynamo.Table.return_value = mock_table
    mock_get_dynamo.return_value = mock_dynamo

    updated = add_device_peer("ap-southeast-2", "MacBook Pro")

    assert len(updated["devices"]) == 2
    new_dev = updated["devices"][1]
    assert new_dev["name"] == "MacBook Pro"
    assert new_dev["ip"] == "10.8.0.3"
    assert new_dev["slot"] == 2


@patch("core.dynamodb.get_dynamodb_resource")
def test_add_device_peer_enforces_maximum_5_devices(mock_get_dynamo):
    """Given a region with 5 active devices, When attempting to add a 6th device,
    Then ValueError must be raised."""
    full_peers = {
        "parameters": "peers_ap-southeast-2",
        "region": "ap-southeast-2",
        "server": {"private_key": "srv_priv", "public_key": "srv_pub"},
        "devices": [
            {"id": f"dev_{i}", "name": f"Dev {i}", "slot": i, "ip": f"10.8.0.{i+1}"}
            for i in range(1, 6)
        ],
    }
    mock_table = MagicMock()
    mock_table.get_item.return_value = {"Item": full_peers}
    mock_dynamo = MagicMock()
    mock_dynamo.Table.return_value = mock_table
    mock_get_dynamo.return_value = mock_dynamo

    with pytest.raises(ValueError, match="Maximum limit of 5 devices reached"):
        add_device_peer("ap-southeast-2", "Excess Device")


@patch("core.dynamodb.get_dynamodb_resource")
def test_delete_device_peer_frees_slot(mock_get_dynamo):
    """Given a region with 2 devices, When deleting one device,
    Then the device is removed from DynamoDB."""
    peers = {
        "parameters": "peers_ap-southeast-2",
        "region": "ap-southeast-2",
        "server": {"private_key": "srv_priv", "public_key": "srv_pub"},
        "devices": [
            {"id": "dev_1", "name": "Phone", "slot": 1, "ip": "10.8.0.2"},
            {"id": "dev_2", "name": "Laptop", "slot": 2, "ip": "10.8.0.3"},
        ],
    }
    mock_table = MagicMock()
    mock_table.get_item.return_value = {"Item": peers}
    mock_dynamo = MagicMock()
    mock_dynamo.Table.return_value = mock_table
    mock_get_dynamo.return_value = mock_dynamo

    updated = delete_device_peer("ap-southeast-2", "dev_1")

    assert len(updated["devices"]) == 1
    assert updated["devices"][0]["id"] == "dev_2"
