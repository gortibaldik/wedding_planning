#!/usr/bin/env python3
import argparse
import base64
from pathlib import Path

parser = argparse.ArgumentParser(
    description="Base64-encode a credentials JSON for use as an env var."
)
parser.add_argument(
    "credentials",
    type=Path,
    nargs="?",
    default=Path(".credentials-google-drive"),
    help="Path to the credentials JSON file",
)
args = parser.parse_args()

if not args.credentials.is_file():
    parser.error(f"file '{args.credentials}' not found")

encoded = base64.b64encode(args.credentials.read_bytes()).decode()
print(f"GOOGLE_APPLICATION_CREDENTIALS_JSON={encoded}")
