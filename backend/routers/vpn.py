"""FastAPI router for VPN management endpoints."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from core.aws import (
    get_instance_status,
    list_active_instances,
    list_regions,
    provision_vpn_instance,
    quick_toggle_vpn_instance,
    start_vpn_instance,
    stop_vpn_instance,
    terminate_vpn_instance,
)
from core.dynamodb import (
    add_device_peer,
    delete_device_peer,
    get_or_create_region_peers,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vpn", tags=["VPN Orchestrator"])


def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> bool:
    """Validate API Key if configured in environment."""
    expected_key = os.getenv("VPN_API_KEY", "").strip()
    if not expected_key:
        return True

    provided = x_api_key
    if not provided and authorization:
        if authorization.startswith("Bearer "):
            provided = authorization[len("Bearer "):].strip()
        else:
            provided = authorization.strip()

    if not provided or provided != expected_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Provide a valid key in 'X-API-Key' or 'Authorization: Bearer <key>'.",
        )
    return True


class RegionItem(BaseModel):
    id: str
    name: str


class SpinUpRequest(BaseModel):
    region: str = Field(..., description="AWS region identifier, e.g. ap-southeast-2")
    instance_type: str = Field(default="t3.micro", description="EC2 instance type")
    allowed_ips: str = Field(default="0.0.0.0/0", description="Split-tunnel CIDR routing range")
    ttl_minutes: int = Field(default=0, description="Session TTL in minutes (0 for warm standby / manual pause)")


class DeviceItem(BaseModel):
    id: str
    name: str
    ip: Optional[str] = None
    slot: Optional[int] = None
    client_config: Optional[str] = None


class AddDeviceRequest(BaseModel):
    region: str = Field(..., description="AWS region identifier")
    name: str = Field(..., description="Device name, e.g. MacBook Pro")


class InstanceResponse(BaseModel):
    instance_id: str
    region: str
    state: str
    public_ip: Optional[str] = None
    instance_type: Optional[str] = None
    launch_time: Optional[str] = None
    client_config: Optional[str] = None
    ttl_minutes: Optional[int] = None
    devices: Optional[List[Dict[str, Any]]] = None


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


@router.get("/instances", response_model=List[InstanceResponse])
def get_instances() -> List[Dict[str, Any]]:
    """List all currently active or bootstrapping VPN instances."""
    try:
        return list_active_instances()
    except Exception as exc:
        logger.error("Failed to list active instances: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/spin-up", response_model=InstanceResponse, dependencies=[Depends(verify_api_key)])
def spin_up_vpn(payload: SpinUpRequest) -> Dict[str, Any]:
    """Dynamically provision a new WireGuard VPN node in the target region."""
    try:
        result = provision_vpn_instance(
            region=payload.region,
            instance_type=payload.instance_type,
            allowed_ips=payload.allowed_ips,
            ttl_minutes=payload.ttl_minutes,
        )
        return result
    except Exception as exc:
        logger.error("Provisioning failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to spin up VPN node: {exc}")


@router.post("/start", response_model=InstanceResponse, dependencies=[Depends(verify_api_key)])
def start_vpn(
    region: str = Query(..., description="AWS region"),
    instance_id: Optional[str] = Query(None, description="Optional target instance ID"),
) -> Dict[str, Any]:
    """Start or resume a stopped VPN node (Warm Standby)."""
    try:
        return start_vpn_instance(region=region, instance_id=instance_id)
    except Exception as exc:
        logger.error("Failed to start VPN instance in %s: %s", region, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/stop", dependencies=[Depends(verify_api_key)])
def stop_vpn(
    region: str = Query(..., description="AWS region"),
    instance_id: Optional[str] = Query(None, description="Optional target instance ID"),
) -> Dict[str, Any]:
    """Pause/sleep an active VPN node to stop compute and IPv4 charges."""
    try:
        return stop_vpn_instance(region=region, instance_id=instance_id)
    except Exception as exc:
        logger.error("Failed to stop VPN instance in %s: %s", region, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/quick-toggle", dependencies=[Depends(verify_api_key)])
def quick_toggle_vpn(
    region: str = Query(..., description="AWS region"),
) -> Dict[str, Any]:
    """1-Tap toggle: Start if stopped/unprovisioned, Stop if currently running."""
    try:
        return quick_toggle_vpn_instance(region=region)
    except Exception as exc:
        logger.error("Failed to toggle VPN in %s: %s", region, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/quick-status")
def quick_status(
    region: str = Query(..., description="AWS region"),
) -> Dict[str, Any]:
    """Quick check for region status (running, stopped, none)."""
    try:
        instances = list_active_instances()
        for inst in instances:
            if inst.get("region") == region:
                return {"region": region, "instance_id": inst.get("instance_id"), "state": inst.get("state")}
        return {"region": region, "state": "none"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/status/{instance_id}", response_model=InstanceResponse)
def get_status(
    instance_id: str,
    region: str = Query(..., description="AWS region where the instance is located"),
) -> Dict[str, Any]:
    """Check current status and retrieve connection details for a VPN node."""
    try:
        status_data = get_instance_status(region=region, instance_id=instance_id)
        return status_data
    except Exception as exc:
        logger.error("Failed to describe instance %s: %s", instance_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/destroy/{instance_id}", response_model=DestroyResponse, dependencies=[Depends(verify_api_key)])
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


@router.get("/devices")
def list_devices(
    region: str = Query(..., description="AWS region"),
) -> Dict[str, Any]:
    """Retrieve registered devices and capacity for a region."""
    try:
        peers = get_or_create_region_peers(region)
        return {
            "region": region,
            "max_devices": peers.get("max_devices", 5),
            "devices": [
                {
                    "id": d["id"],
                    "name": d["name"],
                    "ip": d.get("ip"),
                    "slot": d.get("slot"),
                    "created_at": d.get("created_at"),
                }
                for d in peers.get("devices", [])
            ],
        }
    except Exception as exc:
        logger.error("Failed to retrieve devices for %s: %s", region, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/devices/add", dependencies=[Depends(verify_api_key)])
def add_device(payload: AddDeviceRequest) -> Dict[str, Any]:
    """Register a new device up to the 5-device limit."""
    try:
        updated = add_device_peer(region=payload.region, device_name=payload.name)
        return {
            "region": payload.region,
            "max_devices": updated.get("max_devices", 5),
            "devices": [
                {
                    "id": d["id"],
                    "name": d["name"],
                    "ip": d.get("ip"),
                    "slot": d.get("slot"),
                    "created_at": d.get("created_at"),
                }
                for d in updated.get("devices", [])
            ],
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        logger.error("Failed to add device in %s: %s", payload.region, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/devices/{device_id}", dependencies=[Depends(verify_api_key)])
def delete_device(
    device_id: str,
    region: str = Query(..., description="AWS region"),
) -> Dict[str, Any]:
    """Delete a registered device peer to free a slot."""
    try:
        updated = delete_device_peer(region=region, device_id=device_id)
        return {
            "region": region,
            "max_devices": updated.get("max_devices", 5),
            "devices": [
                {
                    "id": d["id"],
                    "name": d["name"],
                    "ip": d.get("ip"),
                    "slot": d.get("slot"),
                }
                for d in updated.get("devices", [])
            ],
        }
    except Exception as exc:
        logger.error("Failed to delete device %s in %s: %s", device_id, region, exc)
        raise HTTPException(status_code=500, detail=str(exc))

