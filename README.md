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
- **Backend:** Python 3.13 (FastAPI), Boto3 (AWS SDK: EC2, DynamoDB), Cryptography
- **Frontend:** React, TypeScript, Vite, Ant Design
- **Cloud & Infrastructure:** AWS EC2, AWS DynamoDB, Cloudflare Zero Trust
- **Networking:** WireGuard VPN, Split Tunneling
- **DevOps & Containerisation:** Docker, Docker Compose, Github Actions
---

## Key Features

* **Global Multi-Region Dispatch:** Choose from any standard AWS region (Tokyo, London, Sydney, N. Virginia, Frankfurt, etc.).
* **True Ephemeral Lifecycle:** Spin up in ~60 seconds; terminate on demand to pay fractions of a cent per session.
* **DynamoDB Parameter Store:** Cloud-persisted configurations (TTL, monthly budget, default regions, split tunnel subnets) and real-time cost tracking stored in AWS DynamoDB (`aws_global_router_parameters`).
* **Automated Cost Tracking & Visualizer:** Costs automatically update upon instance teardown with itemized breakdowns (EC2, IPv4, EBS, data transfer) and interactive multi-month stacked bar charts.
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
│   │   ├── dynamodb.py          # Boto3 DynamoDB CRUD parameter store & cost tracking
│   │   └── wireguard_template.sh # WireGuard user_data bootstrap script generator
│   └── routers/
│       ├── vpn.py               # API endpoints (/regions, /spin-up, /status, /destroy)
│       └── parameters.py        # DynamoDB endpoints (/settings, /costs, /list, /raw)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx              # Main dashboard view & navigation
        ├── components/
        │   ├── RegionSelect.tsx # Ant Design region selector
        │   ├── QRCodeModal.tsx  # WireGuard pairing modal
        │   ├── StatusCard.tsx   # Active instance state & destroy actions
        │   ├── CostsView.tsx    # DynamoDB cost breakdown & stacked bar chart
        │   ├── SettingsView.tsx # DynamoDB settings configuration
        │   ├── Navbar.tsx       # Top/side navigation bar
        │   └── Footer.tsx       # App footer with copyright and license
        └── api/
            └── vpnClient.ts     # Typed API client with DynamoDB endpoints
```

---

## ⚙️ Getting Started

### Prerequisites

* [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) installed.
* An active **AWS Account** with programmatic IAM credentials for EC2 and DynamoDB.
* **DynamoDB Table:** `aws_global_router_parameters` with partition key `parameters` (String).
* **IAM Permissions:**
  * EC2: `ec2:RunInstances`, `ec2:TerminateInstances`, `ec2:DescribeInstances`, `ec2:CreateSecurityGroup`, `ec2:AuthorizeSecurityGroupIngress`, `ec2:CreateTags`.
  * DynamoDB: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:Scan`.
* Official [WireGuard Client](https://www.wireguard.com/install/) installed on your phone or computer.

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/JuhilKBhatt/AWS-Global-Router.git
   cd AWS-Global-Router
   ```

2. **Configure Credentials:**
   Populate your AWS programmatic credentials in `secrets/.dev.env` (for local development) or `secrets/.prod.env` (for production):
   ```env
   # AWS EC2 Credentials
   AWS_EC2_ACCESS_KEY_ID=your_ec2_access_key_id
   AWS_EC2_SECRET_ACCESS_KEY=your_ec2_secret_access_key
   AWS_EC2_DEFAULT_REGION=ap-southeast-2

   # AWS DynamoDB Credentials
   AWS_DYNAMODB_ACCESS_KEY_ID=your_dynamodb_access_key_id
   AWS_DYNAMODB_SECRET_ACCESS_KEY=your_dynamodb_secret_access_key
   AWS_DYNAMODB_DEFAULT_REGION=ap-southeast-2
   AWS_DYNAMODB_TABLE_NAME=aws_global_router_parameters
   ```

3. **Launch with Docker Compose:**
   * **Development (Live Sync & Hot Reload):**
     ```bash
     docker compose -f docker-compose.dev.yml up --build
     ```
     * Dashboard: [http://localhost:5173](http://localhost:5173)
     * Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

   * **Production:**
     ```bash
     docker compose -f docker-compose.prod.yml up -d --build
     ```
     * Dashboard: [http://localhost](http://localhost)

---

## 📖 Usage Guide

1. **Select Region & Routing Mode:**
   * Select your desired AWS geographic region from the dropdown (e.g., Sydney, Tokyo, Frankfurt, N. Virginia).
   * Specify **Split Tunnel Routing (`AllowedIPs`)**:
     * `0.0.0.0/0`: **Full Tunnel** — Routes all device internet traffic through the AWS gateway.
     * Custom CIDRs (e.g. `10.0.0.0/16, 192.168.1.0/24`): **Split Tunnel** — Only routes target networks through AWS, preserving local connection bandwidth.
2. **Provision the Gateway:**
   * Click **Spin Up WireGuard Endpoint**.
   * The backend dynamically provisions an EC2 instance with an ephemeral security group (UDP 51820) and bootstraps WireGuard via `user-data` in ~60 seconds.
3. **Connect Your Client:**
   * **Mobile (iOS / Android):** Open the WireGuard mobile app, tap `+` > **Create from QR code**, and scan the displayed pairing code.
   * **Desktop (macOS / Windows / Linux):** Download the generated `wg-aws-<region>.conf` file and import it into your desktop WireGuard client.
   * Activate the tunnel in your WireGuard app to start routing traffic.
4. **Instant Teardown:**
   * When your browsing or testing session is complete, click **Destroy VPN** on the active endpoint card.
   * The EC2 instance is terminated immediately to release compute and IPv4 resources and prevent ongoing charges.

---

## 💰 Cost & Resource Optimisation

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