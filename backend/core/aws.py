"""AWS Boto3 EC2 provisioning and lifecycle orchestration logic."""

from __future__ import annotations

import base64
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519

logger = logging.getLogger(__name__)

SECURITY_GROUP_NAME = "aws-global-router-wg-sg"
SECURITY_GROUP_DESC = "Security Group for AWS Global Router WireGuard VPN (UDP 51820)"
DEFAULT_WIREGUARD_PORT = 51820
SESSION_FILE_PATH = Path(os.getenv("VPN_SESSION_FILE", "/app/.sessions.json"))

AWS_REGION_NAMES: Dict[str, str] = {
    # Asia Pacific
    "ap-southeast-2": "Sydney, Australia",
    "ap-southeast-4": "Melbourne, Australia",
    "ap-northeast-1": "Tokyo, Japan",
    "ap-northeast-2": "Seoul, South Korea",
    "ap-northeast-3": "Osaka, Japan",
    "ap-south-1": "Mumbai, India",
    "ap-south-2": "Hyderabad, India",
    "ap-southeast-1": "Singapore",
    "ap-southeast-3": "Jakarta, Indonesia",
    "ap-southeast-5": "Malaysia",
    "ap-southeast-7": "Auckland, New Zealand",
    "ap-east-1": "Hong Kong",

    # North America
    "us-east-1": "N. Virginia, United States",
    "us-east-2": "Ohio, United States",
    "us-west-1": "N. California, United States",
    "us-west-2": "Oregon, United States",
    "ca-central-1": "Central, Canada",
    "ca-west-1": "Calgary, Canada",
    "mx-central-1": "Central, Mexico",

    # Europe
    "eu-west-1": "Dublin, Ireland",
    "eu-west-2": "London, United Kingdom",
    "eu-west-3": "Paris, France",
    "eu-central-1": "Frankfurt, Germany",
    "eu-central-2": "Zurich, Switzerland",
    "eu-north-1": "Stockholm, Sweden",
    "eu-south-1": "Milan, Italy",
    "eu-south-2": "Madrid, Spain",

    # Middle East & Africa
    "me-south-1": "Bahrain",
    "me-central-1": "UAE",
    "il-central-1": "Tel Aviv, Israel",
    "af-south-1": "Cape Town, South Africa",

    # South America
    "sa-east-1": "São Paulo, Brazil",
}

STANDARD_REGIONS = [
    {"id": "ap-southeast-2", "name": "Sydney, Australia"},
    {"id": "ap-southeast-4", "name": "Melbourne, Australia"},
    {"id": "ap-northeast-1", "name": "Tokyo, Japan"},
    {"id": "ap-northeast-3", "name": "Osaka, Japan"},
    {"id": "ap-northeast-2", "name": "Seoul, South Korea"},
    {"id": "ap-south-1", "name": "Mumbai, India"},
    {"id": "ap-southeast-1", "name": "Singapore"},
    {"id": "us-east-1", "name": "N. Virginia, United States"},
    {"id": "us-east-2", "name": "Ohio, United States"},
    {"id": "us-west-1", "name": "N. California, United States"},
    {"id": "us-west-2", "name": "Oregon, United States"},
    {"id": "ca-central-1", "name": "Central, Canada"},
    {"id": "eu-west-1", "name": "Dublin, Ireland"},
    {"id": "eu-west-2", "name": "London, United Kingdom"},
    {"id": "eu-west-3", "name": "Paris, France"},
    {"id": "eu-central-1", "name": "Frankfurt, Germany"},
    {"id": "eu-north-1", "name": "Stockholm, Sweden"},
    {"id": "sa-east-1", "name": "São Paulo, Brazil"},
]


def generate_wireguard_keypair() -> Tuple[str, str]:
    """Generate a standard 32-byte Curve25519 WireGuard keypair in base64 encoding."""
    private_key = x25519.X25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    priv_b64 = base64.b64encode(private_bytes).decode("utf-8")
    pub_b64 = base64.b64encode(public_bytes).decode("utf-8")
    return priv_b64, pub_b64


def _get_session_store_path() -> Path:
    """Resolve writable session storage file path."""
    try:
        SESSION_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        return SESSION_FILE_PATH
    except Exception:
        fallback = Path("/tmp/.sessions.json")
        fallback.parent.mkdir(parents=True, exist_ok=True)
        return fallback


def load_sessions() -> Dict[str, Dict[str, Any]]:
    """Load session metadata from disk."""
    path = _get_session_store_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Could not read sessions file: %s", exc)
        return {}


def save_session(instance_id: str, data: Dict[str, Any]) -> None:
    """Save session metadata for an instance."""
    path = _get_session_store_path()
    sessions = load_sessions()
    sessions[instance_id] = data
    try:
        path.write_text(json.dumps(sessions, indent=2), encoding="utf-8")
        path.chmod(0o600)
    except Exception as exc:
        logger.error("Failed to persist session for %s: %s", instance_id, exc)


def get_session(instance_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve session metadata for an instance."""
    sessions = load_sessions()
    return sessions.get(instance_id)


def delete_session(instance_id: str) -> None:
    """Remove session metadata for a terminated instance."""
    path = _get_session_store_path()
    sessions = load_sessions()
    if instance_id in sessions:
        del sessions[instance_id]
        try:
            path.write_text(json.dumps(sessions, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not update sessions file on delete: %s", exc)


def build_wireguard_client_config(
    client_private_key: str,
    server_public_key: str,
    public_ip: str,
    allowed_ips: str = "0.0.0.0/0",
    port: int = DEFAULT_WIREGUARD_PORT,
) -> str:
    """Construct a valid WireGuard client .conf file with real base64 Curve25519 keys."""
    return f"""[Interface]
PrivateKey = {client_private_key}
Address = 10.8.0.2/24
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = {server_public_key}
Endpoint = {public_ip}:{port}
AllowedIPs = {allowed_ips}
PersistentKeepalive = 25
"""


def get_ec2_client(region_name: str) -> boto3.client:
    """Create a boto3 EC2 client for the specified region."""
    access_key = (
        os.getenv("AWS_EC2_ACCESS_KEY_ID")
        or os.getenv("AWS_ACCESS_KEY_ID")
    )
    secret_key = (
        os.getenv("AWS_EC2_SECRET_ACCESS_KEY")
        or os.getenv("AWS_SECRET_ACCESS_KEY")
    )
    return boto3.client(
        "ec2",
        region_name=region_name,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def list_regions() -> List[Dict[str, str]]:
    """Retrieve list of enabled AWS regions mapped to friendly city/area and country names."""
    try:
        default_region = (
            os.getenv("AWS_EC2_DEFAULT_REGION")
            or os.getenv("AWS_DEFAULT_REGION")
            or "ap-southeast-2"
        )
        client = get_ec2_client(default_region)
        response = client.describe_regions(
            Filters=[{"Name": "opt-in-status", "Values": ["opt-in-not-required", "opted-in"]}]
        )
        regions: List[Dict[str, str]] = []
        for r in response.get("Regions", []):
            rid = r["RegionName"]
            friendly = AWS_REGION_NAMES.get(rid, rid)
            regions.append({
                "id": rid,
                "name": friendly,
            })
        # Sort alphabetically by country/city name for clean user browsing
        regions.sort(key=lambda x: x["name"])
        return regions or STANDARD_REGIONS
    except Exception as exc:
        logger.warning("Failed to describe AWS regions via Boto3, using standard fallback: %s", exc)
        return STANDARD_REGIONS


def get_latest_ubuntu_ami(client: Any) -> str:
    """Find the latest official Canonical Ubuntu 24.04 LTS AMI for x86_64."""
    try:
        response = client.describe_images(
            Owners=["099720109477"],  # Canonical
            Filters=[
                {
                    "Name": "name",
                    "Values": ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"],
                },
                {"Name": "state", "Values": ["available"]},
            ],
        )
        images = response.get("Images", [])
        if not images:
            raise RuntimeError("No Ubuntu 24.04 AMIs found")
        images.sort(key=lambda x: x.get("CreationDate", ""), reverse=True)
        return images[0]["ImageId"]
    except Exception as exc:
        logger.error("Error retrieving Ubuntu AMI: %s", exc)
        raise


def ensure_security_group(client: Any, port: int = DEFAULT_WIREGUARD_PORT) -> str:
    """Ensure the ephemeral WireGuard Security Group exists with UDP ingress allowed."""
    try:
        sgs = client.describe_security_groups(
            Filters=[{"Name": "group-name", "Values": [SECURITY_GROUP_NAME]}]
        )
        if sgs.get("SecurityGroups"):
            return sgs["SecurityGroups"][0]["GroupId"]
    except ClientError as exc:
        logger.info("Security group lookup: %s", exc)

    vpcs = client.describe_vpcs(Filters=[{"Name": "is-default", "Values": ["true"]}])
    vpc_id = vpcs["Vpcs"][0]["VpcId"] if vpcs.get("Vpcs") else None

    kwargs: Dict[str, Any] = {
        "GroupName": SECURITY_GROUP_NAME,
        "Description": SECURITY_GROUP_DESC,
    }
    if vpc_id:
        kwargs["VpcId"] = vpc_id

    create_res = client.create_security_group(**kwargs)
    sg_id = create_res["GroupId"]

    client.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[
            {
                "IpProtocol": "udp",
                "FromPort": port,
                "ToPort": port,
                "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "WireGuard VPN"}],
            }
        ],
    )
    return sg_id


def generate_user_data(
    server_privkey: str,
    client_pubkey: str,
    port: int = DEFAULT_WIREGUARD_PORT,
    ttl_minutes: int = 60,
) -> str:
    """Render bootstrap user-data script from template with injected keypair and TTL."""
    template_path = Path(__file__).parent / "wireguard_template.sh"
    if not template_path.exists():
        raise FileNotFoundError(f"Template script missing at {template_path}")

    script = template_path.read_text(encoding="utf-8")
    script = script.replace('SERVER_PORT="${SERVER_PORT:-51820}"', f'SERVER_PORT="{port}"')
    script = script.replace('SERVER_PRIVKEY="${SERVER_PRIVKEY:-}"', f'SERVER_PRIVKEY="{server_privkey}"')
    script = script.replace('CLIENT_PUBKEY="${CLIENT_PUBKEY:-}"', f'CLIENT_PUBKEY="{client_pubkey}"')
    script = script.replace('TTL_MINUTES="${TTL_MINUTES:-60}"', f'TTL_MINUTES="{ttl_minutes}"')
    return script


def provision_vpn_instance(
    region: str,
    instance_type: str = "t3.micro",
    allowed_ips: str = "0.0.0.0/0",
    ttl_minutes: int = 60,
) -> Dict[str, Any]:
    """Provision a new ephemeral EC2 instance configured with WireGuard and automated TTL."""
    client = get_ec2_client(region)
    ami_id = get_latest_ubuntu_ami(client)
    sg_id = ensure_security_group(client)

    server_priv, server_pub = generate_wireguard_keypair()
    client_priv, client_pub = generate_wireguard_keypair()

    user_data_script = generate_user_data(
        server_privkey=server_priv,
        client_pubkey=client_pub,
        port=DEFAULT_WIREGUARD_PORT,
        ttl_minutes=ttl_minutes,
    )

    run_kwargs: Dict[str, Any] = {
        "ImageId": ami_id,
        "InstanceType": instance_type,
        "MinCount": 1,
        "MaxCount": 1,
        "SecurityGroupIds": [sg_id],
        "UserData": user_data_script,
        "TagSpecifications": [
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": "aws-global-router-vpn-node"},
                    {"Key": "ManagedBy", "Value": "aws-global-router"},
                    {"Key": "Region", "Value": region},
                    {"Key": "TTL", "Value": str(ttl_minutes)},
                ],
            }
        ],
    }

    # Automatically terminate instance when shutdown is invoked by the TTL script
    if ttl_minutes > 0:
        run_kwargs["InstanceInitiatedShutdownBehavior"] = "terminate"

    run_response = client.run_instances(**run_kwargs)

    instance = run_response["Instances"][0]
    instance_id = instance["InstanceId"]

    save_session(
        instance_id=instance_id,
        data={
            "instance_id": instance_id,
            "region": region,
            "instance_type": instance_type,
            "allowed_ips": allowed_ips,
            "ttl_minutes": ttl_minutes,
            "client_private_key": client_priv,
            "client_public_key": client_pub,
            "server_public_key": server_pub,
            "port": DEFAULT_WIREGUARD_PORT,
        },
    )

    return {
        "instance_id": instance_id,
        "region": region,
        "instance_type": instance_type,
        "state": instance["State"]["Name"],
        "launch_time": instance["LaunchTime"].isoformat() if "LaunchTime" in instance else None,
        "ttl_minutes": ttl_minutes,
    }


def get_instance_status(region: str, instance_id: str) -> Dict[str, Any]:
    """Query current status, public IP, and build WireGuard profile for the VPN instance."""
    client = get_ec2_client(region)
    response = client.describe_instances(InstanceIds=[instance_id])
    reservations = response.get("Reservations", [])
    if not reservations or not reservations[0].get("Instances"):
        raise ValueError(f"Instance {instance_id} not found in {region}")

    inst = reservations[0]["Instances"][0]
    public_ip = inst.get("PublicIpAddress")
    state = inst.get("State", {}).get("Name", "unknown")
    session = get_session(instance_id)

    result: Dict[str, Any] = {
        "instance_id": instance_id,
        "region": region,
        "state": state,
        "public_ip": public_ip,
        "instance_type": inst.get("InstanceType"),
        "launch_time": inst.get("LaunchTime").isoformat() if "LaunchTime" in inst else None,
        "ttl_minutes": session.get("ttl_minutes", 60) if session else None,
    }

    if public_ip:
        if session and session.get("client_private_key") and session.get("server_public_key"):
            result["client_config"] = build_wireguard_client_config(
                client_private_key=session["client_private_key"],
                server_public_key=session["server_public_key"],
                public_ip=public_ip,
                allowed_ips=session.get("allowed_ips", "0.0.0.0/0"),
                port=session.get("port", DEFAULT_WIREGUARD_PORT),
            )
        else:
            result["client_config"] = (
                "# Instance was provisioned before cryptographic keypair tracking was initialized.\n"
                "# Please destroy this instance and spin up a new node to obtain a valid WireGuard profile."
            )

    return result


def list_active_instances() -> List[Dict[str, Any]]:
    """Query and return all active VPN nodes across recorded sessions."""
    sessions = load_sessions()
    active_instances: List[Dict[str, Any]] = []

    for instance_id, session in list(sessions.items()):
        region = session.get("region")
        if not region:
            continue
        try:
            status = get_instance_status(region, instance_id)
            if status["state"] in ["terminated"]:
                delete_session(instance_id)
            else:
                active_instances.append(status)
        except Exception as exc:
            logger.warning("Could not fetch status for session %s: %s", instance_id, exc)
            if "not found" in str(exc).lower() or "InvalidInstanceID.NotFound" in str(exc):
                delete_session(instance_id)

    return active_instances


def terminate_vpn_instance(region: str, instance_id: str) -> Dict[str, Any]:
    """Terminate the ephemeral EC2 instance and delete session metadata."""
    client = get_ec2_client(region)
    term_res = client.terminate_instances(InstanceIds=[instance_id])
    state_updates = term_res.get("TerminatingInstances", [])
    current_state = state_updates[0]["CurrentState"]["Name"] if state_updates else "shutting-down"

    # Calculate elapsed duration and record usage into DynamoDB
    session = get_session(instance_id)
    if session and session.get("launch_time"):
        try:
            import datetime
            launch_dt = datetime.datetime.fromisoformat(session["launch_time"])
            now_dt = datetime.datetime.now(datetime.timezone.utc)
            duration_hrs = max((now_dt - launch_dt).total_seconds() / 3600.0, 0.05)
            from core.dynamodb import record_usage_cost
            record_usage_cost(instance_id=instance_id, elapsed_hours=duration_hrs, region=region)
        except Exception as err:
            logger.warning("Could not calculate or record session cost: %s", err)

    delete_session(instance_id)

    return {
        "instance_id": instance_id,
        "region": region,
        "state": current_state,
        "message": f"Instance {instance_id} termination initiated.",
    }
