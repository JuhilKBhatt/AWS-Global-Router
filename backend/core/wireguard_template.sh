#!/usr/bin/env bash
set -euo pipefail

# Parameters supplied via templating
SERVER_PORT="${SERVER_PORT:-51820}"
SERVER_NET="${SERVER_NET:-10.8.0.1/24}"
CLIENT_NET="${CLIENT_NET:-10.8.0.2/32}"
ALLOWED_IPS="${ALLOWED_IPS:-0.0.0.0/0}"
DNS_SERVERS="${DNS_SERVERS:-1.1.1.1,1.0.0.1}"

# Update and install WireGuard & qrencode
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y wireguard iptables qrencode

# Enable IPv4 Packet Forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard-forward.conf
sysctl --system

# Determine default network interface
DEFAULT_IFACE=$(ip -4 route show default | awk '{print $5}' | head -n1)

# Generate WireGuard Server & Client Keys
umask 077
mkdir -p /etc/wireguard

SERVER_PRIVKEY=$(wg genkey)
SERVER_PUBKEY=$(echo "${SERVER_PRIVKEY}" | wg pubkey)

CLIENT_PRIVKEY=$(wg genkey)
CLIENT_PUBKEY=$(echo "${CLIENT_PRIVKEY}" | wg pubkey)

# Save Server Config
cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
Address = ${SERVER_NET}
ListenPort = ${SERVER_PORT}
PrivateKey = ${SERVER_PRIVKEY}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o ${DEFAULT_IFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o ${DEFAULT_IFACE} -j MASQUERADE

[Peer]
PublicKey = ${CLIENT_PUBKEY}
AllowedIPs = ${CLIENT_NET}
EOF

# Fetch Public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || curl -s https://checkip.amazonaws.com)

# Generate Client Config
cat <<EOF > /etc/wireguard/client.conf
[Interface]
PrivateKey = ${CLIENT_PRIVKEY}
Address = 10.8.0.2/24
DNS = ${DNS_SERVERS}

[Peer]
PublicKey = ${SERVER_PUBKEY}
Endpoint = ${PUBLIC_IP}:${SERVER_PORT}
AllowedIPs = ${ALLOWED_IPS}
PersistentKeepalive = 25
EOF

# Enable and start WireGuard service
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

# Mark bootstrapping complete
echo "WIREGUARD_READY" > /etc/wireguard/.ready
