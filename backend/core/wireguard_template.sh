#!/usr/bin/env bash
set -euo pipefail

# Parameters supplied via backend templating
SERVER_PORT="${SERVER_PORT:-51820}"
SERVER_NET="${SERVER_NET:-10.8.0.1/24}"
CLIENT_NET="${CLIENT_NET:-10.8.0.2/32}"
SERVER_PRIVKEY="${SERVER_PRIVKEY:-}"
CLIENT_PUBKEY="${CLIENT_PUBKEY:-}"

# Update and install WireGuard
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y wireguard iptables

# Enable IPv4 Packet Forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard-forward.conf
sysctl --system

# Determine default network interface
DEFAULT_IFACE=$(ip -4 route show default | awk '{print $5}' | head -n1)

# Ensure directory with restricted permissions
umask 077
mkdir -p /etc/wireguard

# Save Server Config with injected server private key and client public key
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

# Enable and start WireGuard service
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

# Mark bootstrapping complete
echo "WIREGUARD_READY" > /etc/wireguard/.ready
