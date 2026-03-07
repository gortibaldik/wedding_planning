import base64
import zlib


def decompress(value):
    return zlib.decompress(base64.b64decode(value)).decode()


def compress(value: str):
    return base64.b64encode(zlib.compress(value.encode())).decode()
