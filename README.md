# AWS Global Router

> **Ephemeral, On-Demand Multi-Region WireGuard VPN Orchestrator**

AWS Global Router is a self-hosted cloud automation platform that dynamically provisions and tears down disposable WireGuard VPN endpoints across global AWS regions. Designed for privacy, split-tunnel routing, and cost efficiency, AWS Global Router replaces persistent, costly cloud VPN instances with ephemeral EC2 nodes accessible via a secure web dashboard.

---

## 📌 Architecture Overview

```text
[ Client Device ] 
       │ (WireGuard Tunnel - UDP 51820 / Split Routing)
       ▼
 [ AWS EC2 Node ] (Auto-provisioned in selected Region)
       ▲
       │ Provisioning / UserData Handshake
 [ Python Backend ] (FastAPI + Boto3) ◄── Docker Network ──► [ Vite + TS Frontend ]
                                                                       ▲
                                                                       │ HTTPS
                                                          [ Cloudflare Zero Trust ]
                                                                       ▲
                                                                       │
                                                                 [ User Browser ]
```

1. **Control Plane:** A containerized FastAPI backend and React/Vite dashboard running locally (e.g., on a home Ubuntu server), exposed securely through a Cloudflare Zero Trust tunnel without opening inbound ports.
2. **Infrastructure Automation:** Upon request, the backend leverages AWS Boto3 to provision an Amazon EC2 `t3.micro` or `t4g.micro` instance in the selected target region.
3. **Automated Bootstrap:** EC2 `user-data` automatically installs WireGuard, generates client/server cryptographic key pairs, enables IPv4 forwarding, and registers the client configuration.
4. **Instant Pairing:** The generated WireGuard profile is displayed in the dashboard as a scannable QR code (for mobile) and a downloadable `.conf` file (for desktop/laptop).
5. **Split Tunneling:** Traffic routing is constrained via customizable `AllowedIPs`, ensuring only targeted IP ranges flow through AWS while general traffic remains on local Wi-Fi or cellular data.
6. **Teardown:** A single-click destroy action (or automated idle TTL) terminates the EC2 instance immediately to eliminate ongoing compute and IPv4 charges.

---

### Tech stack
- **Backend:** Python 3.13 (FastAPI/Flask), Boto3 (AWS SDK)
- **Frontend:** React, TypeScript, Vite, Ant Design
- **Cloud & Infrastructure:** AWS EC2, Cloudflare Zero Trust
- **Networking:** WireGuard VPN, Split Tunneling
- **DevOps & Containerisation:** Docker, Docker Compose, Github Actions
---

## Key Features

* **Global Multi-Region Dispatch:** Choose from any standard AWS region (Tokyo, London, Sydney, N. Virginia, Frankfurt, etc.).
* **True Ephemeral Lifecycle:** Spin up in ~60 seconds; terminate on demand to pay fractions of a cent per session.
* **Custom Split Tunneling:** Route only specific corporate subnets, lab networks, or web targets through the tunnel, preserving mobile and home bandwidth.
* **Mobile & Desktop Friendly:** Scan the generated QR code directly in the official WireGuard app on iOS/Android or copy the client profile to macOS/Windows/Linux.
* **Hardened Security Posture:** 
  * Only UDP port 51820 is exposed to the public internet on the EC2 security group.
  * Web management UI requires zero port forwarding, protected by Cloudflare Access.

---

## Project Structure

```text
aws-global-router/
├── docker-compose.prod.yml
├── docker-compose.dev.yml
├── secrets/
│   ├── .prod.env
│   ├── .dev.env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI application entrypoint
│   ├── core/
│   │   ├── aws.py               # Boto3 EC2 provisioning & teardown logic
│   │   └── wireguard_template.sh         # WireGuard user_data bootstrap script generator
│   └── routers/
│       └── vpn.py               # API endpoints (/regions, /spin-up, /status, /destroy)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx              # Main dashboard view
        ├── components/
        │   ├── RegionSelect.tsx # Ant Design region selector
        │   ├── QRCodeModal.tsx  # WireGuard pairing modal
        │   └── StatusCard.tsx   # Active instance state & destroy actions
        └── api/
            └── vpnClient.ts     # Typed API client
```

---

## ⚙️ Getting Started

### Prerequisites

* [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) installed.
* An active **AWS Account** with programmatic IAM credentials.
* **IAM Permissions:** Policies allowing `ec2:RunInstances`, `ec2:TerminateInstances`, `ec2:DescribeInstances`, `ec2:CreateSecurityGroup`, `ec2:AuthorizeSecurityGroupIngress`, and `ec2:CreateTags`.
* Official [WireGuard Client](https://www.wireguard.com/install/) installed on your phone or computer.

### Installation

---

## 📖 Usage Guide

---

## 💰 Cost & Resource Optimization

* **Free Tier:** Eligible for the standard 750 hours/month of `t2.micro` or `t3.micro` during the first 12 months of AWS account ownership.
* **Post-Free Tier On-Demand:** 
  * Running an instance for **1 hour** costs approximately **$0.015 – $0.025 USD** ($0.02 – $0.035 AUD), factoring in compute, storage, and IPv4 allocation fees.
  * Always click **Destroy** after completing your task to prevent recurring hourly charges.

---

## 🛡 Security Notes
* **No SSH Required:** The EC2 instances do not launch with SSH key pairs. Administrative access is omitted entirely to minimize attack surfaces.
* **Ephemeral Ephemerality:** Since servers are constantly rebuilt from clean official Ubuntu AMIs, persistence threats are mitigated.
* **Credential Isolation:** AWS API credentials remain strictly confined within the backend container environment and are never forwarded or exposed to the frontend browser bundle.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.