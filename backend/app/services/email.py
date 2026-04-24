"""
邮件发送服务（Resend）

需要环境变量 RESEND_API_KEY
配置方式：在 backend/.env 中添加 RESEND_API_KEY=re_xxxx
"""
import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "noreply@alwayshaha.art")
RESEND_BASE_URL = "https://api.resend.com"


def _get_client() -> Optional[httpx.Client]:
    if not RESEND_API_KEY:
        return None
    return httpx.Client(
        base_url=RESEND_BASE_URL,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=10.0,
    )


def send_password_reset_email(to_email: str, reset_url: str) -> tuple[bool, str]:
    """
    发送密码重置邮件。

    Args:
        to_email: 收件人邮箱
        reset_url: 重置链接

    Returns:
        (success, error_message)
    """
    client = _get_client()
    if client is None:
        logger.warning("[email] RESEND_API_KEY not set, skipping email send")
        return False, "邮件服务未配置（RESEND_API_KEY 未设置）"

    subject = "重置你的密码 - Standup"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a;">重置密码</h2>
      <p style="color: #444; font-size: 15px;">
        你请求重置密码，点击下面的按钮设置新密码：
      </p>
      <a href="{reset_url}"
         style="display: inline-block; margin: 20px 0; padding: 12px 24px;
                background: #6366f1; color: #fff; text-decoration: none;
                border-radius: 8px; font-weight: 600;">
        重置密码
      </a>
      <p style="color: #888; font-size: 13px;">
        如果你没有请求过重置密码，请忽略这封邮件。<br>
        此链接 1 小时后失效。
      </p>
    </div>
    """

    try:
        resp = client.post("/email", json={
            "from": RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        if resp.status_code == 200 or resp.status_code == 201:
            logger.info(f"[email] password reset sent to {to_email}")
            return True, ""
        else:
            logger.error(f"[email] failed to send: {resp.status_code} {resp.text}")
            return False, f"邮件发送失败（{resp.status_code}），请稍后重试"
    except Exception as e:
        logger.exception(f"[email] exception: {e}")
        return False, "邮件发送异常，请稍后重试"
    finally:
        client.close()
