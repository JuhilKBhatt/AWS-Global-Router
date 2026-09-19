"""AWS DynamoDB integration for managing, loading, tracking, and deleting parameters."""

from __future__ import annotations

import datetime
from decimal import Decimal
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Automatically load secrets from dev/prod env files if available
for env_candidate in [
    Path("/app/secrets/.dev.env"),
    Path("/app/secrets/.prod.env"),
    Path(__file__).parent.parent.parent / "secrets" / ".dev.env",
    Path(__file__).parent.parent.parent / "secrets" / ".prod.env",
]:
    if env_candidate.exists():
        load_dotenv(dotenv_path=env_candidate, override=False)

logger = logging.getLogger(__name__)

TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "aws_global_router_parameters")
PARTITION_KEY = "parameters"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "ttlMinutes": 60,
    "monthlyBudget": 5.0,
    "budgetAlertEnabled": True,
    "defaultRegion": "ap-southeast-2",
    "defaultAllowedIps": "0.0.0.0/0",
    "defaultInstanceType": "t3.micro",
}


def get_current_month_abbr() -> str:
    """Return 3-letter abbreviation of current UTC month (e.g. Sep)."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%b")


def get_clean_initial_costs() -> Dict[str, Any]:
    """Return zeroed initial cost structure without any mock data."""
    return {
        "currentMonth": {
            "month": get_current_month_abbr(),
            "ec2": 0.0,
            "ip": 0.0,
            "ebs": 0.0,
            "transfer": 0.0,
        },
        "history": [],
        "totalHours": 0.0,
    }


def _convert_floats_to_decimals(obj: Any) -> Any:
    """Recursively convert Python floats to Decimals for DynamoDB serialization."""
    if isinstance(obj, float):
        return Decimal(str(round(obj, 4)))
    elif isinstance(obj, dict):
        return {k: _convert_floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_floats_to_decimals(i) for i in obj]
    return obj


def _convert_decimals_to_floats(obj: Any) -> Any:
    """Recursively convert Decimals to standard floats for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _convert_decimals_to_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_decimals_to_floats(i) for i in obj]
    return obj


def get_dynamodb_resource() -> Any:
    """Initialize Boto3 DynamoDB resource using dedicated credentials."""
    region = (
        os.getenv("AWS_DYNAMODB_DEFAULT_REGION")
        or os.getenv("AWS_EC2_DEFAULT_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "ap-southeast-2"
    )
    access_key = (
        os.getenv("AWS_DYNAMODB_ACCESS_KEY_ID")
        or os.getenv("AWS_EC2_ACCESS_KEY_ID")
        or os.getenv("AWS_ACCESS_KEY_ID")
    )
    secret_key = (
        os.getenv("AWS_DYNAMODB_SECRET_ACCESS_KEY")
        or os.getenv("AWS_EC2_SECRET_ACCESS_KEY")
        or os.getenv("AWS_SECRET_ACCESS_KEY")
    )

    return boto3.resource(
        "dynamodb",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def get_dynamodb_table() -> Any:
    """Get DynamoDB table handle."""
    resource = get_dynamodb_resource()
    return resource.Table(TABLE_NAME)


def get_parameter(name: str) -> Optional[Dict[str, Any]]:
    """Fetch parameter item by name from DynamoDB."""
    table = get_dynamodb_table()
    try:
        response = table.get_item(Key={PARTITION_KEY: name})
        item = response.get("Item")
        if not item:
            return None
        return _convert_decimals_to_floats(item)
    except ClientError as exc:
        logger.error("Error reading parameter %s from DynamoDB: %s", name, exc)
        raise


def put_parameter(name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create or overwrite a parameter item in DynamoDB."""
    table = get_dynamodb_table()
    item = _convert_floats_to_decimals(payload)
    item[PARTITION_KEY] = name
    item["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        table.put_item(Item=item)
        return _convert_decimals_to_floats(item)
    except ClientError as exc:
        logger.error("Error writing parameter %s to DynamoDB: %s", name, exc)
        raise


def update_parameter(name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Partially update attributes of an existing parameter item."""
    current = get_parameter(name) or {}
    merged = {**current, **updates}
    return put_parameter(name, merged)


def delete_parameter(name: str) -> bool:
    """Delete a parameter item from DynamoDB."""
    table = get_dynamodb_table()
    try:
        table.delete_item(Key={PARTITION_KEY: name})
        return True
    except ClientError as exc:
        logger.error("Error deleting parameter %s from DynamoDB: %s", name, exc)
        return False


def list_parameters() -> List[str]:
    """List all parameter keys in the DynamoDB table."""
    table = get_dynamodb_table()
    try:
        response = table.scan(
            ProjectionExpression="#p",
            ExpressionAttributeNames={"#p": PARTITION_KEY},
        )
        items = response.get("Items", [])
        return [i[PARTITION_KEY] for i in items if PARTITION_KEY in i]
    except ClientError as exc:
        logger.error("Error listing parameters in DynamoDB: %s", exc)
        return []


# ----------------------------------------------------------------------
# Specialized Methods for Settings
# ----------------------------------------------------------------------

def load_settings() -> Dict[str, Any]:
    """Load settings parameter directly from DynamoDB."""
    try:
        item = get_parameter("settings")
        if item:
            # Strip partition key and metadata
            return {
                "ttlMinutes": int(item.get("ttlMinutes", DEFAULT_SETTINGS["ttlMinutes"])),
                "monthlyBudget": float(item.get("monthlyBudget", DEFAULT_SETTINGS["monthlyBudget"])),
                "budgetAlertEnabled": bool(item.get("budgetAlertEnabled", DEFAULT_SETTINGS["budgetAlertEnabled"])),
                "defaultRegion": str(item.get("defaultRegion", DEFAULT_SETTINGS["defaultRegion"])),
                "defaultAllowedIps": str(item.get("defaultAllowedIps", DEFAULT_SETTINGS["defaultAllowedIps"])),
                "defaultInstanceType": str(item.get("defaultInstanceType", DEFAULT_SETTINGS["defaultInstanceType"])),
                "updated_at": item.get("updated_at"),
            }
        # Initialize default settings directly in DynamoDB if not present
        saved = put_parameter("settings", DEFAULT_SETTINGS)
        return {
            "ttlMinutes": DEFAULT_SETTINGS["ttlMinutes"],
            "monthlyBudget": DEFAULT_SETTINGS["monthlyBudget"],
            "budgetAlertEnabled": DEFAULT_SETTINGS["budgetAlertEnabled"],
            "defaultRegion": DEFAULT_SETTINGS["defaultRegion"],
            "defaultAllowedIps": DEFAULT_SETTINGS["defaultAllowedIps"],
            "defaultInstanceType": DEFAULT_SETTINGS["defaultInstanceType"],
            "updated_at": saved.get("updated_at"),
        }
    except Exception as exc:
        logger.error("Failed to load settings from DynamoDB: %s", exc)
        raise


def save_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Persist settings parameter to DynamoDB."""
    cleaned: Dict[str, Any] = {
        "ttlMinutes": int(settings.get("ttlMinutes", 60)),
        "monthlyBudget": float(settings.get("monthlyBudget", 5.0)),
        "budgetAlertEnabled": bool(settings.get("budgetAlertEnabled", True)),
        "defaultRegion": str(settings.get("defaultRegion", "ap-southeast-2")),
        "defaultAllowedIps": str(settings.get("defaultAllowedIps", "0.0.0.0/0")),
        "defaultInstanceType": str(settings.get("defaultInstanceType", "t3.micro")),
    }
    return put_parameter("settings", cleaned)


# ----------------------------------------------------------------------
# Specialized Methods for Costs
# ----------------------------------------------------------------------

def load_costs() -> Dict[str, Any]:
    """Load cost analytics parameter directly from DynamoDB."""
    try:
        item = get_parameter("costs")
        if item:
            curr = item.get("currentMonth") or {
                "month": get_current_month_abbr(),
                "ec2": 0.0,
                "ip": 0.0,
                "ebs": 0.0,
                "transfer": 0.0,
            }
            return {
                "currentMonth": {
                    "month": str(curr.get("month", get_current_month_abbr())),
                    "ec2": float(curr.get("ec2", 0.0)),
                    "ip": float(curr.get("ip", 0.0)),
                    "ebs": float(curr.get("ebs", 0.0)),
                    "transfer": float(curr.get("transfer", 0.0)),
                },
                "history": item.get("history", []),
                "totalHours": float(item.get("totalHours", 0.0)),
                "updated_at": item.get("updated_at"),
                "last_terminated_instance": item.get("last_terminated_instance"),
            }
        # Initialize zeroed baseline costs directly in DynamoDB if record does not exist
        clean_costs = get_clean_initial_costs()
        saved = put_parameter("costs", clean_costs)
        return {
            "currentMonth": clean_costs["currentMonth"],
            "history": [],
            "totalHours": 0.0,
            "updated_at": saved.get("updated_at"),
            "last_terminated_instance": None,
        }
    except Exception as exc:
        logger.error("Failed to load costs from DynamoDB: %s", exc)
        raise


def save_costs(data: Dict[str, Any]) -> Dict[str, Any]:
    """Persist cost analytics parameter to DynamoDB."""
    return put_parameter("costs", data)


def record_usage_cost(instance_id: str, elapsed_hours: float, region: str) -> None:
    """Accumulate usage hours and estimated AWS costs into DynamoDB upon instance termination."""
    try:
        hours = max(elapsed_hours, 0.05)  # Minimum session threshold ~3 mins
        costs_data = load_costs()

        # Rates: t3.micro ~ $0.0104/hr, IPv4 ~ $0.005/hr, EBS ~ $0.001/hr
        ec2_add = round(hours * 0.0104, 4)
        ip_add = round(hours * 0.005, 4)
        ebs_add = round(hours * 0.001, 4)
        transfer_add = round(hours * 0.0005, 4)

        current_month_abbr = get_current_month_abbr()
        current = costs_data.get("currentMonth") or {
            "month": current_month_abbr,
            "ec2": 0.0,
            "ip": 0.0,
            "ebs": 0.0,
            "transfer": 0.0,
        }

        # If month rolled over, archive to history
        history = costs_data.get("history", [])
        if current.get("month") and current.get("month") != current_month_abbr:
            history.append({
                "month": current["month"],
                "ec2": round(float(current.get("ec2", 0.0)), 2),
                "ip": round(float(current.get("ip", 0.0)), 2),
                "ebs": round(float(current.get("ebs", 0.0)), 2),
                "transfer": round(float(current.get("transfer", 0.0)), 2),
            })
            current = {
                "month": current_month_abbr,
                "ec2": 0.0,
                "ip": 0.0,
                "ebs": 0.0,
                "transfer": 0.0,
            }

        current["ec2"] = round(float(current.get("ec2", 0)) + ec2_add, 2)
        current["ip"] = round(float(current.get("ip", 0)) + ip_add, 2)
        current["ebs"] = round(float(current.get("ebs", 0)) + ebs_add, 2)
        current["transfer"] = round(float(current.get("transfer", 0)) + transfer_add, 2)

        total_hours = round(float(costs_data.get("totalHours", 0)) + hours, 1)

        updated_payload = {
            "currentMonth": current,
            "history": history,
            "totalHours": total_hours,
            "last_terminated_instance": {
                "instance_id": instance_id,
                "region": region,
                "hours": round(hours, 2),
                "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            },
        }
        save_costs(updated_payload)
        logger.info(
            "Tracked cost for instance %s: +%.2f hrs ($%.4f EC2, $%.4f IP) into DynamoDB",
            instance_id,
            hours,
            ec2_add,
            ip_add,
        )
    except Exception as exc:
        logger.error("Failed to record usage cost in DynamoDB for %s: %s", instance_id, exc)
