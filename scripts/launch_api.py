"""Daemonized launcher for the CyberSaathi FastAPI service.

Uses the standard double-fork pattern to fully detach from the calling shell
so the API survives shell-timeout teardowns.
"""
import os
import sys
from pathlib import Path

API_DIR = Path("/home/wysh/Documents/coding/cybersaathi/apps/api")
LAUNCHER = API_DIR / "run_api.py"
LOG = "/tmp/cs-api.log"


def daemonize() -> None:
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    sys.stdout.flush()
    sys.stderr.flush()
    with open("/dev/null", "rb", 0) as devnull_in:
        os.dup2(devnull_in.fileno(), 0)
    with open(LOG, "ab", 0) as log_out:
        os.dup2(log_out.fileno(), 1)
        os.dup2(log_out.fileno(), 2)


if __name__ == "__main__":
    daemonize()
    os.chdir(API_DIR)
    os.execvp(
        sys.executable,
        [sys.executable, str(LAUNCHER)],
    )
