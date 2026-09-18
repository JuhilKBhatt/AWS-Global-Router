"""AWS Boto3 EC2 provisioning and lifecycle orchestration logic."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

SECURITY_GROUP_NAME = "aws-global-router-wg-sg"
SECURITY_GROUP_DESC = "Security Group for AWS Global Router WireGuard VPN (UDP 51820)"
DEFAULT_WIREGUARD_PORT = 51820

STANDARD_REGIONS = [
    {"id": "ap-southeast-2", "name": "Sydney (ap-southeast-2)"},
    {"id": "us-east-1", "name": "N. Virginia (us-east-1)"},
    {"id": "us-west-2", "name": "Oregon (us-west-2)"},
    {"id": "eu-west-1", "name": "Ireland (eu-west-1)"},
    {"id": "eu-central-1", "name": "Frankfurt (eu-central-1)"},
    {"id": "ap-northeast-1", "name": "Tokyo (ap-northeast-1)"},
    {"id": "ap-southeast-1", "name": "Singapore (ap-southeast-1)"},
    {"id": "eu-west-2", "name": "London (eu-west-2)"},
]


def get_ec2_client(region_name: str) -> boto3.client:
    """Create a boto3 EC2 client for the specified region."""
    return boto3.client(
        "ec2",
        region_name=region_name,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def list_regions() -> List[Dict[str, str]]:
    """Retrieve list of enabled AWS regions, falling back to standard presets."""
    try:
        default_region = os.getenv("AWS_DEFAULT_REGION", "ap-southeast-2")
        client = get_ec2_client(default_region)
        response = client.describe_regions(
            Filters=[{"Name": "opt-in-status", "Values": ["opt-in-not-required", "opted-in"]}]
        )
        regions = [
            {"id": r["RegionName"], "name": f"{r['RegionName']}"}
            for r in response.get("Regions", [])
        ]
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
        # Sort by CreationDate descending
        images.sort(key=lambda x: x.get("CreationDate", ""), reverse=True)
        return images[0]["ImageId"]
    except Exception as exc:
        logger.error("Error retrieving Ubuntu AMI: %s", exc)
        raise


def ensure_security_group(client: Any, port: int = DEFAULT_WIREGUARD_PORT) -> str:
    """Ensure the ephemeral WireGuard Security Group exists with UDP ingress allowed."""
    try:
        # Check if already exists
        sgs = client.describe_security_groups(
            Filters=[{"Name": "group-name", "Values": [SECURITY_GROUP_NAME]}]
        )
        if sgs.get("SecurityGroups"):
            return sgs["SecurityGroups"][0]["GroupId"]
    except ClientError as exc:
        logger.info("Security group lookup: %s", exc)

    # Create security group
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

    # Authorize UDP port for WireGuard
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


def generate_user_data(allowed_ips: str = "0.0.0.0/0", port: int = DEFAULT_WIREGUARD_PORT) -> str:
    """Render bootstrap user-data script from template."""
    template_path = Path(__file__).parent / "wireguard_template.sh"
    if not template_path.exists():
        raise FileNotFoundError(f"Template script missing at {template_path}")

    script = template_path.read_text(encoding="utf-8")
    script = script.replace('SERVER_PORT="${SERVER_PORT:-51820}"', f'SERVER_PORT="{port}"')
    script = script.replace('ALLOWED_IPS="${ALLOWED_IPS:-0.0.0.0/0}"', f'ALLOWED_IPS="{allowed_ips}"')
    return script


def provision_vpn_instance(
    region: str,
    instance_type: str = "t3.micro",
    allowed_ips: str = "0.0.0.0/0",
) -> Dict[str, Any]:
    """Provision a new ephemeral EC2 instance configured with WireGuard."""
    client = get_ec2_client(region)
    ami_id = get_latest_ubuntu_ami(client)
    sg_id = ensure_security_group(client)
    user_data_script = generate_user_data(allowed_ips=allowed_ips)

    run_response = client.run_instances(
        ImageId=ami_id,
        InstanceType=instance_type,
        MinCount=1,
        MaxCount=1,
        SecurityGroupIds=[sg_id],
        UserData=user_data_script,
        TagSpecifications=[
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": "aws-global-router-vpn-node"},
                    {"Key": "ManagedBy", "Value": "aws-global-router"},
                    {"Key": "Region", "Value": region},
                ],
            }
        ],
    )

    instance = run_response["Instances"][0]
    return {
        "instance_id": instance["InstanceId"],
        "region": region,
        "instance_type": instance_type,
        "state": instance["State"]["Name"],
        "launch_time": instance["LaunchTime"].isoformat() if "LaunchTime" in instance else None,
    }


def get_instance_status(region: str, instance_id: str) -> Dict[str, Any]:
    """Query current status, public IP, and state of the VPN instance."""
    client = get_ec2_client(region)
    response = client.describe_instances(InstanceIds=[instance_id])
    reservations = response.get("Reservations", [])
    if not reservations or not reservations[0].get("Instances"):
        raise ValueError(f"Instance {instance_id} not found in {region}")

    inst = reservations[0]["Instances"][0]
    public_ip = inst.get("PublicIpAddress")
    state = inst.get("State", {}).get("Name", "unknown")

    return {
        "instance_id": instance_id,
        "region": region,
        "state": state,
        "public_ip": public_ip,
        "instance_type": inst.get("InstanceType"),
        "launch_time": inst.get("LaunchTime").isoformat() if "LaunchTime" in inst else None,
    }


def terminate_vpn_instance(region: str, instance_id: str) -> Dict[str, Any]:
    """Terminate the ephemeral EC2 instance."""
    client = get_ec2_client(region)
    term_res = client.terminate_instances(InstanceIds=[instance_id])
    state_updates = term_res.get("TerminatingInstances", [])
    current_state = state_updates[0]["CurrentState"]["Name"] if state_updates else "shutting-down"

    return {
        "instance_id": instance_id,
        "region": region,
        "state": current_state,
        "message": f"Instance {instance_id} termination initiated.",
    }
