from __future__ import annotations

import os
from pathlib import Path

import boto3
from botocore.client import Config


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value


def make_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=_required_env("S3_ENDPOINT_URL"),
        aws_access_key_id=_required_env("S3_ACCESS_KEY"),
        aws_secret_access_key=_required_env("S3_SECRET_KEY"),
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def bucket_name() -> str:
    return _required_env("S3_BUCKET")


def upload_artifact(local_path: Path, key: str) -> str:
    make_s3_client().upload_file(
        str(local_path),
        bucket_name(),
        key,
        ExtraArgs={
            "ContentType": "application/x-ndjson",
            "CacheControl": "private, max-age=604800",
        },
    )
    return key


def download_artifact(key: str, local_path: Path) -> Path:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    make_s3_client().download_file(bucket_name(), key, str(local_path))
    return local_path
