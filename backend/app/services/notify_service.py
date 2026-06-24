"""Pluggable notification service (operator-facing).

Local/dev: logs to stdout (no-op) when SLACK_WEBHOOK_URL is unset.
Prod: posts to a Slack incoming webhook.
Best-effort — never raises into the request path.
"""
import os
import json
import logging
import urllib.request

logger = logging.getLogger("notify")

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

# Event types
SENSITIVE_ACCESS_GRANT = "SENSITIVE_ACCESS_GRANT"

_MESSAGES = {
    SENSITIVE_ACCESS_GRANT: ":lock: Sensitive-document access grant issued (user {uid}) after password re-verification.",
}


def _configured() -> bool:
    return bool(SLACK_WEBHOOK_URL)


def notify(event_type: str, uid: int) -> bool:
    """Post a Slack alert. Returns True only if actually sent.

    Logs and returns False when no webhook is configured (local/dev).
    """
    template = _MESSAGES.get(event_type, "DocSentinel security event: {event} (user {uid})")
    text = template.format(event=event_type, uid=uid)

    if not _configured():
        logger.info("notify[no-op]: %s", text)
        return False

    try:
        data = json.dumps({"text": text}).encode("utf-8")
        req = urllib.request.Request(
            SLACK_WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            ok = resp.status == 200
        logger.info("notify[sent]: %s", text)
        return ok
    except Exception as exc:  # best-effort, never raise into request
        logger.warning("notify[failed]: %s err=%s", text, exc)
        return False
