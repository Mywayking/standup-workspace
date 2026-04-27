"""加密工具：API Key 加密/解密/脱敏"""
import os
import re
import base64
from cryptography.fernet import Fernet

_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        from ..config import settings
        secret = getattr(settings, "MODEL_KEY_ENCRYPTION_SECRET", None) or os.getenv("MODEL_KEY_ENCRYPTION_SECRET", "")
        if not secret:
            # 首次启动自动生成
            secret = base64.b64encode(os.urandom(32)).decode()
            env_path = os.path.join(os.path.dirname(__file__), "../../../.env")
            with open(env_path, "a") as f:
                f.write(f"\nMODEL_KEY_ENCRYPTION_SECRET={secret}\n")
        _fernet = Fernet(secret.encode())
    return _fernet


def encrypt_api_key(api_key: str) -> str:
    """加密存储"""
    fernet = _get_fernet()
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    """解密（仅后端内存使用，永不外传）"""
    fernet = _get_fernet()
    return fernet.decrypt(ciphertext.encode()).decode()


def mask_key(api_key: str) -> str:
    """脱敏展示：sk-****abcd"""
    if not api_key or len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}****{api_key[-4:]}"


def redact_sensitive(text: str) -> str:
    """日志脱敏"""
    return re.sub(r"sk-[A-Za-z0-9_\-]{8,}", "sk-****", text)