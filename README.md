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
2. **Infrastructure Automation:** Upon request, the backend leverages AWS Boto3 to provision an Amazon EC2 `t3.micro` instance in the selected target region.
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
* **Multi-Device Mesh Allocation (v1.2.0):** Connect up to **5 devices** simultaneously per WireGuard gateway (`10.8.0.2` through `10.8.0.6`) with independent cryptographic keypairs, live capacity tracking, and an interactive **"+ Add Device"** manager in the UI.
* **Warm Standby Lifecycle (v1.2.0):** Pause (Stop) and Resume (Start) nodes on demand. Pausing immediately releases AWS public IPv4 addresses and halts EC2 compute charges while preserving EBS root volume state, slashing boot time to ~10–15 seconds upon restart.
* **Anonymous Dynamic DNS (DuckDNS, v1.2.0):** Automatically binds WireGuard endpoints to `<subdomain>.duckdns.org:51820`. Preserves mobile and desktop `.conf` configurations across EC2 pause/resume cycles while masking domain ownership and WHOIS footprints.
* **Hardened REST Control Plane (v1.2.0):** All mutating API endpoints (`/spin-up`, `/start`, `/stop`, `/devices/*`) are fortified with API key authentication (`X-API-Key`).
* **DynamoDB Parameter Store:** Cloud-persisted configurations (TTL, monthly budget, default regions, split tunnel subnets, region device keypairs) and real-time cost tracking stored in AWS DynamoDB (`aws_global_router_parameters`).
* **Automated Cost Tracking & Visualizer:** Costs automatically update upon instance teardown with itemized breakdowns (EC2, IPv4, EBS, data transfer) and interactive multi-month stacked bar charts.
* **Custom Split Tunneling:** Route only specific corporate subnets, lab networks, or web targets through the tunnel, preserving mobile and home bandwidth.
* **Mobile & Desktop Friendly:** Scan the generated QR code directly in the official WireGuard app on iOS/Android or download device-specific `.conf` profiles for macOS/Windows/Linux.
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
│   ├── pytest.ini
│   ├── main.py                  # FastAPI application entrypoint
│   ├── core/
│   │   ├── aws.py               # Boto3 EC2 provisioning, warm standby & teardown
│   │   ├── dynamodb.py          # Boto3 DynamoDB CRUD parameter store & 5-device peer store
│   │   ├── duckdns.py           # Anonymous DuckDNS dynamic IP synchronization
│   │   └── wireguard_template.sh # Multi-peer WireGuard user_data bootstrap generator
│   ├── routers/
│   │   ├── vpn.py               # API endpoints (/regions, /spin-up, /start, /stop, /devices)
│   │   └── parameters.py        # DynamoDB endpoints (/settings, /costs, /list, /raw)
│   └── tests/
│       ├── test_api_security.py # API key authentication tests
│       ├── test_devices.py      # 5-device peer allocation & limit tests
│       ├── test_duckdns.py      # DuckDNS synchronization tests
│       └── test_wireguard_template.py # Multi-peer config generation tests
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx              # Main dashboard view & navigation
        ├── components/
        │   ├── RegionSelect.tsx # Ant Design region selector
        │   ├── QRCodeModal.tsx  # Multi-device WireGuard pairing & Add Device modal
        │   ├── StatusCard.tsx   # Active instances, Pause/Start warm standby & destroy actions
        │   ├── CostsView.tsx    # DynamoDB cost breakdown & stacked bar chart
        │   ├── SettingsView.tsx # DynamoDB settings & v1.2.0 architecture overview
        │   ├── SideNavBar.tsx   # Top/side navigation bar
        │   └── AppFooter.tsx    # App footer with copyright and license
        └── api/
            └── vpnClient.ts     # Typed API client with warm standby and device management
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

   # Optional: Anonymous Dynamic DNS (DuckDNS)
   DUCKDNS_DOMAIN=your-subdomain
   DUCKDNS_TOKEN=your_duckdns_token

   # Optional: REST API Key Authentication
   VPN_API_KEY=your_secure_api_key

   # Optional: Lifecycle Mode (ephemeral | standby)
   VPN_LIFECYCLE_MODE=standby
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
     * Dashboard & Reverse Proxy: [http://localhost](http://localhost) (or `http://localhost:<FRONTEND_PORT>`)
     * *Note: The production Nginx container serves the frontend and reverse proxies `/api` directly to the backend over the internal Docker network (`router_net`). The backend is not exposed directly on host port 8000, preventing port collisions with other host services.*

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
   * **Desktop (macOS / Windows / Linux):** Download the generated `<instance_id>.conf` file and import it into your desktop WireGuard client.
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

## 🛡 Security & Privacy Architecture

* **No SSH Required:** The EC2 instances do not launch with SSH key pairs. Administrative access is omitted entirely to eliminate attack surfaces.
* **Ephemeral Ephemerality:** Servers are spun up on-demand from clean, official Canonical Ubuntu LTS AMIs and permanently deleted after use, eliminating persistence threats.
* **Stealth Firewall:** The EC2 Security Group (`aws-global-router-wg-sg`) only allows UDP port 51820. WireGuard drops all unauthenticated packets silently, making the instance appear as an empty, unresponsive IP to port scanners.
* **Credential Isolation:** AWS API credentials remain strictly confined within the backend container environment (`secrets/`) and are never forwarded or exposed to the frontend browser bundle.

---

## ❓ Frequently Asked Questions & Deep Dive

### 1. How does the Session TTL work? If my backend goes down, will it still kill the EC2?

**Yes, guaranteed.** The teardown does **not** rely on your local machine, Docker, or an internet connection staying active. It is enforced at the **AWS cloud hypervisor level** through two mechanisms:

1. **Autonomous Linux Timer:** During initial bootstrap on AWS hardware, the cloud-init script schedules a native operating system shutdown:
   ```bash
   shutdown -h "+${TTL_MINUTES}" "AWS Global Router session TTL expired" &
   ```
2. **AWS Hypervisor Auto-Destroy:** When provisioning the EC2 node, Boto3 sets:
   ```python
   run_kwargs["InstanceInitiatedShutdownBehavior"] = "terminate"
   ```
When the countdown expires inside the Linux guest OS, AWS interprets the shutdown signal as an instruction to **permanently terminate and delete the instance**, releasing the public IPv4 and compute resources immediately.

---

### 2. What do destination websites, apps, and games see?

Any website or service you connect to sees the **AWS cloud node**, completely masking your identity:

| Attribute | Without VPN | With AWS Global Router |
| :--- | :--- | :--- |
| **Public IPv4** | Your real residential/mobile IP (e.g. `121.45.x.x`) | **The AWS Public IP** (e.g. `13.239.x.x`) |
| **ISP / Organization** | Your local ISP (e.g., Telstra, Comcast, Rogers) | **Amazon.com, Inc. / AWS** |
| **ASN (Autonomous System)** | Residential ASN | **AS16509 (Amazon.com)** |
| **Geographic Location** | Your physical city & neighborhood | **The selected AWS region** (e.g., Osaka, Japan) |
| **DNS Resolver** | Your ISP's default DNS | **Cloudflare Privacy DNS (`1.1.1.1`)** |

*Note: If you are logged into a personal account on a website (e.g., Google or Discord), the service already has your profile information stored on their servers. The VPN masks your network routing and location, not your logged-in profile identity.*

---

### 3. What does my local Wi-Fi network admin or ISP see?

Your local network administrator (hotel, airport, school, or home router) and your ISP see **only encrypted UDP noise** heading to an Amazon data center:

* **What they CANNOT see (100% Encrypted):**
  * Specific websites and full URLs visited.
  * DNS domain lookup queries (DNS travels to `1.1.1.1` inside the tunnel).
  * Page content, messages, search keywords, and passwords.
  * App, gaming, or video streaming traffic.
* **What they CAN see:**
  * That your device is sending UDP packets on port 51820 to an Amazon AWS IP address.
  * The total bandwidth consumed and connection timestamps.

**What appears in their router firewall log:**
```text
[21:18:22] Source: 192.168.1.45:51820  ──►  Destination: 13.239.112.44:51820 (Amazon.com, Inc.)  [UDP / Encrypted]
[21:18:23] Source: 192.168.1.45:51820  ──►  Destination: 13.239.112.44:51820 (Amazon.com, Inc.)  [UDP / Encrypted]
```

---

### 4. How do regional age checks and SafeSearch work?

* **Regional Age-Gate Laws:** Many jurisdictions enforce digital ID or credit card verification based on the incoming visitor's IP address. By routing through an AWS region that does not mandate these laws (e.g. Frankfurt, Germany or Oregon, US), services apply the policies of that AWS region, bypassing local IP-based age gates.
* **SafeSearch & Network Filtering:** Many schools, workplaces, or ISPs force SafeSearch by intercepting unencrypted DNS queries. Because all DNS in your WireGuard profile resolves through **Cloudflare (`1.1.1.1`)** inside the encrypted tunnel, local network filters cannot intercept or force SafeSearch. You retain full control in your browser's search engine settings.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.