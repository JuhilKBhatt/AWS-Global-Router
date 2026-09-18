"""FastAPI router for VPN management endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from core.aws import (
    get_instance_status,
    list_regions,
    provision_vpn_instance,
    terminate_vpn_instance,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vpn", tags=["VPN Orchestrator"])


class RegionItem(BaseModel):
    id: str
    name: str


class SpinUpRequest(BaseModel):
    region: str = Field(..., description="AWS region identifier, e.g. ap-southeast-2")
    instance_type: str = Field(default="t3.micro", description="EC2 instance type")
    allowed_ips: str = Field(default="0.0.0.0/0", description="Split-tunnel CIDR routing range")


class InstanceResponse(BaseModel):
    instance_id: str
    region: str
    state: str
    public_ip: Optional[str] = None
    instance_type: Optional[str] = None
    launch_time: Optional[str] = None
    client_config: Optional[str] = None


class DestroyResponse(BaseModel):
    instance_id: str
    region: str
    state: str
    message: str


@router.get("/regions", response_model=List[RegionItem])
def get_regions() -> List[Dict[str, str]]:
    """Fetch list of available standard and configured AWS regions."""
    try:
        return list_regions()
    except Exception as exc:
        logger.error("Failed to list regions: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/spin-up", response_model=InstanceResponse)
def spin_up_vpn(payload: SpinUpRequest) -> Dict[str, Any]:
    """Dynamically provision a new WireGuard VPN node in the target region."""
    try:
        result = provision_vpn_instance(
            region=payload.region,
            instance_type=payload.instance_type,
            allowed_ips=payload.allowed_ips,
        )
        return result
    except Exception as exc:
        logger.error("Provisioning failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to spin up VPN node: {exc}")


@router.get("/status/{instance_id}", response_model=InstanceResponse)
def get_status(
    instance_id: str,
    region: str = Query(..., description="AWS region where the instance is located"),
) -> Dict[str, Any]:
    """Check current status and retrieve connection details for a VPN node."""
    try:
        status_data = get_instance_status(region=region, instance_id=instance_id)

        # Build sample WireGuard client config if public IP is available
        public_ip = status_data.get("public_ip")
        if public_ip:
            sample_conf = f"""[Interface]
PrivateKey = CLIENT_PRIVATE_KEY_GENERATED_ON_BOOT
Address = 10.8.0.2/24
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_GENERATED_ON_BOOT
Endpoint = {public_ip}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
"""
            status_data["client_config"] = sample_conf

        return status_data
    except Exception as exc:
        logger.error("Failed to describe instance %s: %s", instance_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/destroy/{instance_id}", response_model=DestroyResponse)
def destroy_vpn(
    instance_id: str,
    region: str = Query(..., description="AWS region where the instance is located"),
) -> Dict[str, Any]:
    """Terminate the VPN instance immediately to eliminate ongoing compute charges."""
    try:
        result = terminate_vpn_instance(region=region, instance_id=instance_id)
        return result
    except Exception as exc:
        logger.error("Failed to terminate instance %s: %s", instance_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))
