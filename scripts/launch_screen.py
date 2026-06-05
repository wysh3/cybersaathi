"""Launch a long-running command via screen(1) so it survives shell teardowns."""
import os
import shlex
import subprocess
import sys

SOCKET = "cs"
LOG = sys.argv[3] if len(sys.argv) > 3 else "/tmp/cs-screen.log"


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: launch_screen.py <name> <cmd> [log]", file=sys.stderr)
        return 2
    name, cmd = sys.argv[1], sys.argv[2]
    quoted = shlex.quote(cmd)
    subprocess.run(
        [
            "screen",
            "-dmS",
            f"{SOCKET}-{name}",
            "-L",
            "-Logfile",
            LOG,
            "bash",
            "-c",
            cmd,
        ],
        check=True,
    )
    print(f"launched {name} as {SOCKET}-{name} (log: {LOG})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
