import socket
import struct
import logging
from typing import Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

CHUNK_SIZE = 4096
EICAR_TEST = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class ClamAVScanner:
    def __init__(self):
        self.host = settings.CLAMAV_HOST
        self.port = settings.CLAMAV_PORT
        self.enabled = settings.CLAMAV_ENABLED

    def _connect(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30)
        sock.connect((self.host, self.port))
        return sock

    def scan_bytes(self, data: bytes) -> Tuple[str, str]:
        """
        Scan bytes for malware.
        Returns: (status, result) where status is 'clean', 'infected', or 'error'
        """
        if not self.enabled:
            # Check for EICAR test string in dev mode
            if EICAR_TEST in data:
                return "infected", "EICAR-Test-File (simulated)"
            return "clean", "Scanning disabled (dev mode)"

        try:
            sock = self._connect()

            # Send INSTREAM command
            sock.send(b"zINSTREAM\0")

            # Send data in chunks
            for i in range(0, len(data), CHUNK_SIZE):
                chunk = data[i:i + CHUNK_SIZE]
                size = struct.pack("!I", len(chunk))
                sock.send(size + chunk)

            # Send terminator
            sock.send(struct.pack("!I", 0))

            # Read response
            response = b""
            while True:
                chunk = sock.recv(1024)
                if not chunk:
                    break
                response += chunk
                if b"\0" in chunk:
                    break

            sock.close()
            result = response.decode().strip("\0").strip()
            logger.info(f"ClamAV scan result: {result}")

            if "FOUND" in result:
                virus_name = result.split(":")[1].strip().replace(" FOUND", "") if ":" in result else "Unknown"
                return "infected", virus_name
            elif "OK" in result or "stream: OK" in result:
                return "clean", "No threats found"
            else:
                return "error", f"Unexpected response: {result}"

        except ConnectionRefusedError:
            logger.warning("ClamAV not available - skipping scan")
            return "error", "ClamAV service unavailable"
        except Exception as e:
            logger.error(f"ClamAV scan error: {e}")
            return "error", str(e)

    def ping(self) -> bool:
        """Check if ClamAV is available."""
        if not self.enabled:
            return False
        try:
            sock = self._connect()
            sock.send(b"zPING\0")
            response = sock.recv(10)
            sock.close()
            return response == b"PONG\0"
        except Exception:
            return False


scanner = ClamAVScanner()
