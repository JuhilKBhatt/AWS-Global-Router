"""FastAPI router for DynamoDB-backed parameters management."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.dynamodb import (
    delete_parameter,
    get_parameter,
    list_parameters,
    load_costs,
    load_settings,
    put_parameter,
    save_costs,
    save_settings,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parameters", tags=["Parameters & DynamoDB"])


class SettingsModel(BaseModel):
    ttlMinutes: int = Field(default=60, description="Session TTL in minutes")
    monthlyBudget: float = Field(default=5.0, description="Monthly budget limit in USD")
    budgetAlertEnabled: bool = Field(default=True, description="Budget alert notification flag")
    defaultRegion: str = Field(default="ap-southeast-2", description="Default AWS region")
    defaultAllowedIps: str = Field(default="0.0.0.0/0", description="Default WireGuard CIDR routing range")
    defaultInstanceType: str = Field(default="t3.micro", description="Default EC2 instance type")
    updated_at: Optional[str] = None


class MonthCostItem(BaseModel):
    month: str
    ec2: float
    ip: float
    ebs: float
    transfer: float


class CostsResponse(BaseModel):
    currentMonth: MonthCostItem
    history: List[MonthCostItem]
    totalHours: float
    updated_at: Optional[str] = None
    last_terminated_instance: Optional[Dict[str, Any]] = None


# ----------------------------------------------------------------------
# Settings Endpoints
# ----------------------------------------------------------------------

@router.get("/settings", response_model=SettingsModel)
def get_settings():
    """Load system settings from DynamoDB."""
    try:
        return load_settings()
    except Exception as exc:
        logger.error("Failed to load settings: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/settings", response_model=SettingsModel)
def update_settings(payload: SettingsModel):
    """Save or update system settings in DynamoDB."""
    try:
        data = payload.model_dump(exclude_unset=True)
        return save_settings(data)
    except Exception as exc:
        logger.error("Failed to save settings: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ----------------------------------------------------------------------
# Costs Analytics Endpoints
# ----------------------------------------------------------------------

@router.get("/costs", response_model=CostsResponse)
def get_costs():
    """Load real-time spend breakdown and historical costs from DynamoDB."""
    try:
        return load_costs()
    except Exception as exc:
        logger.error("Failed to load costs: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/costs")
def update_costs(payload: Dict[str, Any]):
    """Update or reset costs analytics in DynamoDB."""
    try:
        return save_costs(payload)
    except Exception as exc:
        logger.error("Failed to update costs: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ----------------------------------------------------------------------
# Generic Parameter Management Endpoints
# ----------------------------------------------------------------------

@router.get("/list", response_model=List[str])
def list_all_parameters():
    """List all parameter keys tracked in the DynamoDB table."""
    try:
        return list_parameters()
    except Exception as exc:
        logger.error("Failed to list parameters: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/raw/{name}")
def get_raw_parameter(name: str):
    """Fetch raw parameter item by name from DynamoDB."""
    try:
        data = get_parameter(name)
        if data is None:
            raise HTTPException(status_code=404, detail=f"Parameter '{name}' not found")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch parameter %s: %s", name, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/raw/{name}")
def set_raw_parameter(name: str, payload: Dict[str, Any]):
    """Create or overwrite a parameter item in DynamoDB."""
    try:
        return put_parameter(name, payload)
    except Exception as exc:
        logger.error("Failed to save parameter %s: %s", name, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/raw/{name}")
def delete_raw_parameter(name: str):
    """Delete a parameter item from DynamoDB."""
    try:
        success = delete_parameter(name)
        return {"deleted": success, "parameter": name}
    except Exception as exc:
        logger.error("Failed to delete parameter %s: %s", name, exc)
        raise HTTPException(status_code=500, detail=str(exc))
