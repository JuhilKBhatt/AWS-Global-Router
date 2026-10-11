"""Dynamic DNS (DuckDNS) integration for AWS Global Router."""

from __future__ import annotations

import logging
import os
import urllib.parse
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)


def sync_duckdns_ip(
    ip: str,
    domain: Optional[str] = None,
    token: Optional[str] = None,
) -> bool:
    """Update DuckDNS record with the active EC2 public IP."""
    target_domain = (domain or os.getenv("DUCKDNS_DOMAIN", "")).strip()
    target_token = (token or os.getenv("DUCKDNS_TOKEN", "")).strip()

    if not target_domain or not target_token or not ip:
        logger.debug("DuckDNS credentials or IP missing. Skipping DNS sync.")
        return False

    # Extract subdomain prefix if user provided full hostname (e.g. 'my-vpn.duckdns.org')
    if target_domain.endswith(".duckdns.org"):
        target_domain = target_domain[:-len(".duckdns.org")]

    try:
        url = (
            f"https://www.duckdns.org/update?"
            f"domains={urllib.parse.quote(target_domain)}"
            f"&token={urllib.parse.quote(target_token)}"
            f"&ip={urllib.parse.quote(ip)}"
        )
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AWS-Global-Router/1.2.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8").strip()
            if body == "OK":
                logger.info("Successfully updated DuckDNS domain '%s' to IP %s", target_domain, ip)
                return True
            else:
                logger.warning("DuckDNS update for domain '%s' returned: %s", target_domain, body)
                return False
    except Exception as exc:
        logger.warning("DuckDNS update failed for '%s': %s", target_domain, exc)
        return False
