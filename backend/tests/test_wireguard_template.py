"""Tests for WireGuard multi-peer template rendering."""

from core.aws import generate_multi_peer_user_data, build_wireguard_client_config


def test_generate_multi_peer_user_data():
    """Given a server private key and 3 client device peers,
    When generating user-data,
    Then all 3 [Peer] blocks with unique AllowedIPs must be in wg0.conf."""
    server_privkey = "srv_priv_123"
    devices = [
        {"name": "iPhone", "public_key": "pub_key_1", "ip": "10.8.0.2"},
        {"name": "MacBook", "public_key": "pub_key_2", "ip": "10.8.0.3"},
        {"name": "Desktop", "public_key": "pub_key_3", "ip": "10.8.0.4"},
    ]

    script = generate_multi_peer_user_data(
        server_privkey=server_privkey,
        devices=devices,
        port=51820,
        ttl_minutes=60,
    )

    assert 'SERVER_PRIVKEY="srv_priv_123"' in script
    assert "PublicKey = pub_key_1" in script
    assert "AllowedIPs = 10.8.0.2/32" in script
    assert "PublicKey = pub_key_2" in script
    assert "AllowedIPs = 10.8.0.3/32" in script
    assert "PublicKey = pub_key_3" in script
    assert "AllowedIPs = 10.8.0.4/32" in script


def test_build_wireguard_client_config_uses_endpoint_host():
    """Given a DuckDNS endpoint host,
    When generating client .conf,
    Then the Endpoint must target the DuckDNS host."""
    conf = build_wireguard_client_config(
        client_private_key="priv_test",
        server_public_key="pub_server_test",
        public_ip="13.239.1.1",
        endpoint_host="cloud-gw.duckdns.org",
        client_ip="10.8.0.3/32",
    )

    assert "PrivateKey = priv_test" in conf
    assert "Address = 10.8.0.3/24" in conf
    assert "PublicKey = pub_server_test" in conf
    assert "Endpoint = cloud-gw.duckdns.org:51820" in conf


def test_generate_multi_peer_user_data_ttl_disabled():
    """Given ttl_minutes=0 (disabled for warm standby),
    When generating user-data,
    Then TTL_MINUTES must be '0' and no shutdown timer will execute."""
    script = generate_multi_peer_user_data(
        server_privkey="srv_priv_test",
        devices=[],
        port=51820,
        ttl_minutes=0,
    )
    assert 'TTL_MINUTES="0"' in script
