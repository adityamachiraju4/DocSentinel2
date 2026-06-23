import os
import uuid
from pathlib import Path
import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

# Load .env before reading any environment variables (import-order safe)
load_dotenv()

# ── Config from environment (set in Railway, never hardcoded) ──
R2_ENDPOINT_URL = os.environ["R2_ENDPOINT_URL"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET_NAME = os.environ["R2_BUCKET_NAME"]
# ENCRYPTION_KEY is 64 hex chars = 32 bytes = AES-256
ENCRYPTION_KEY = bytes.fromhex(os.environ["ENCRYPTION_KEY"])
# AES-GCM standard nonce size is 12 bytes (96 bits)
_NONCE_SIZE = 12

# ── R2 client (S3-compatible) ──
# region_name="auto" is what Cloudflare R2 expects.
def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )

def _encrypt(plaintext: bytes) -> bytes:
    """
    Encrypt bytes with AES-256-GCM.
    Output layout: [12-byte nonce][ciphertext + 16-byte auth tag].
    The nonce is random per file and stored alongside the ciphertext.
    """
    aesgcm = AESGCM(ENCRYPTION_KEY)
    nonce = os.urandom(_NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext

def _decrypt(blob: bytes) -> bytes:
    """
    Reverse of _encrypt: split off the nonce, then decrypt + verify the tag.
    Raises if the data was tampered with or the key is wrong.
    """
    aesgcm = AESGCM(ENCRYPTION_KEY)
    nonce, ciphertext = blob[:_NONCE_SIZE], blob[_NONCE_SIZE:]
    return aesgcm.decrypt(nonce, ciphertext, None)

def save_file(file_bytes: bytes, original_filename: str) -> str:
    """
    Encrypt the file, upload the ciphertext to R2, and return the storage_key
    (the object key we store in the DB). Same signature as before.
    """
    unique_id = str(uuid.uuid4())[:8]
    extension = Path(original_filename).suffix
    storage_key = f"{unique_id}{extension}"
    encrypted = _encrypt(file_bytes)
    _r2_client().put_object(
        Bucket=R2_BUCKET_NAME,
        Key=storage_key,
        Body=encrypted,
        ContentType="application/octet-stream",  # always opaque ciphertext
    )
    return storage_key

def get_file(storage_key: str) -> bytes:
    """
    Download the ciphertext from R2 and return the decrypted original bytes.
    """
    obj = _r2_client().get_object(Bucket=R2_BUCKET_NAME, Key=storage_key)
    encrypted = obj["Body"].read()
    return _decrypt(encrypted)

def delete_file(storage_key: str) -> None:
    """
    Delete an object from R2 by its storage key.
    """
    _r2_client().delete_object(Bucket=R2_BUCKET_NAME, Key=storage_key)