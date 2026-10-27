"""SSH command runner for the videogen VPS deploy.

Usage:
    python vps.py "<shell command>"
    python vps.py --file local_path remote_path   # scp upload

Reads password from VPS_SSH_PW env var. Prints stdout+stderr merged.
"""
import os
import sys
import stat
import paramiko

# Force UTF-8 stdout/stderr so emoji/arrows in remote output don't crash Windows cp1252
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "37.187.139.100"
PORT = 20033
USER = "root"


def _client():
    pw = os.environ.get("VPS_SSH_PW")
    if not pw:
        sys.exit("VPS_SSH_PW env var not set")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=pw, timeout=20,
              allow_agent=False, look_for_keys=False)
    return c


def run(cmd: str, timeout: int = 300):
    c = _client()
    try:
        stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=False)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        sys.stdout.write(out)
        if err:
            sys.stderr.write(err)
        sys.exit(code)
    finally:
        c.close()


def upload(local: str, remote: str):
    c = _client()
    try:
        sftp = c.open_sftp()
        if os.path.isdir(local):
            _upload_dir(sftp, local, remote)
        else:
            with open(local, "rb") as f:
                sftp.putfo(f, remote)
        print(f"uploaded {local} -> {remote}")
    finally:
        c.close()


def _upload_dir(sftp, local: str, remote: str):
    try:
        sftp.mkdir(remote)
    except IOError:
        pass
    for item in os.listdir(local):
        lp = os.path.join(local, item)
        rp = remote.rstrip("/") + "/" + item
        if os.path.isdir(lp):
            _upload_dir(sftp, lp, rp)
        else:
            with open(lp, "rb") as f:
                sftp.putfo(f, rp)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit("usage: vps.py '<cmd>' | --file local remote")
    if args[0] == "--file":
        upload(args[1], args[2])
    else:
        run(" ".join(args))
