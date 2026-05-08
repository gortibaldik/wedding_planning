import asyncio
import base64
import io
import json
import logging
import threading

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
logger = logging.getLogger(__name__)


def build_drive_service(credentials_json_b64: str):
    info = json.loads(base64.b64decode(credentials_json_b64))
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=SCOPES
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


class InvalidGoogleDriveReadError(ValueError):
    def __init__(self, filename: str, folder_id: str):
        super().__init__(f"File {filename} in folder {folder_id} couldn't be found.")


lock = threading.Lock()


async def read_json_file(
    credentials_json_b64: str, folder_id: str, filename: str
) -> dict:
    def _download() -> dict:
        service = build_drive_service(credentials_json_b64)
        logger.info("Started downloading %s from %s from gdrive", filename, folder_id)
        query = f"'{folder_id}' in parents and name = '{filename}' and trashed = false"
        results = service.files().list(q=query, fields="files(id)").execute()
        files = results.get("files", [])
        if not files:
            raise InvalidGoogleDriveReadError(filename=filename, folder_id=folder_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(
            buf, service.files().get_media(fileId=files[0]["id"])
        )
        done = False
        while not done:
            _, done = downloader.next_chunk()
        logger.info("Finished downloading %s from %s from gdrive", filename, folder_id)
        return json.loads(buf.getvalue())

    return await asyncio.to_thread(_download)
