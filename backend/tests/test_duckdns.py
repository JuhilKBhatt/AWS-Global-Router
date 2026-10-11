"""Tests for DuckDNS synchronization."""

from unittest.mock import patch, MagicMock
from core.duckdns import sync_duckdns_ip


@patch("urllib.request.urlopen")
def test_sync_duckdns_ip_success(mock_urlopen):
    """Given valid domain, token, and IP, When syncing with DuckDNS,
    Then it should call DuckDNS API and return True when response is OK."""
    mock_resp = MagicMock()
    mock_resp.read.return_value = b"OK"
    mock_resp.__enter__.return_value = mock_resp
    mock_urlopen.return_value = mock_resp

    success = sync_duckdns_ip(
        ip="13.239.50.20",
        domain="my-vpn-gw",
        token="test-token-123",
    )

    assert success is True
    assert mock_urlopen.called
    req = mock_urlopen.call_args[0][0]
    assert "domains=my-vpn-gw" in req.full_url
    assert "token=test-token-123" in req.full_url
    assert "ip=13.239.50.20" in req.full_url


def test_sync_duckdns_skips_when_missing_credentials():
    """Given missing domain or token, When syncing, Then it returns False without error."""
    with patch.dict("os.environ", {}, clear=True):
        assert sync_duckdns_ip(ip="1.2.3.4", domain="", token="") is False
