r"""
sync_ops_archive.py
Synchronizes archived scratchpad entries from Vercel /api/archive into
the local Markdown backlog file G:\My Drive\pleasant-ridge-gazette\data\ops_backlog.md
"""
import os
import sys
import json
import urllib.request
from datetime import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

API_URL = "https://pleasant-ridge-gazette.vercel.app/api/archive"
BACKLOG_MD = os.path.join(os.path.dirname(__file__), "data", "ops_backlog.md")
BACKLOG_JSON = os.path.join(os.path.dirname(__file__), "data", "ops_backlog.json")

def sync_archive():
    print(f"[*] Querying live archive feed: {API_URL}")
    req = urllib.request.Request(API_URL, headers={"User-Agent": "Household-Ops-Sync/1.0"})
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                print(f"[!] Server returned status {resp.status}")
                return
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] Could not fetch from {API_URL}: {e}")
        return

    items = data.get("items", [])
    print(f"[+] Retrieved {len(items)} archived backlog entries.")

    # Save raw JSON backup
    with open(BACKLOG_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

    # Re-render Markdown file
    lines = [
        "# Household Ops & Shop Guide — Archived Backlog\n",
        "> Confidential backlog of future system requirements, fleet additions, and sprint ideas archived from the mobile scratchpad.\n",
        f"> Last Synchronized: {datetime.now().strftime('%Y-%m-%d %I:%M %p')}\n",
        f"> Total Logged Entries: {len(items)}\n",
        "\n---\n",
        "## Active Backlog Items\n\n"
    ]

    if not items:
        lines.append("*No archived items logged yet. Items archived from the Household Ops Scratchpad will appear here.*\n")
    else:
        for idx, item in enumerate(items, 1):
            ts = item.get("timestamp", "")
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                formatted_date = dt.strftime("%b %d, %Y • %I:%M %p")
            except Exception:
                formatted_date = ts
            
            text = item.get("text", "").strip()
            lines.append(f"### {idx}. [{formatted_date}]\n\n")
            lines.append(f"```text\n{text}\n```\n\n")

    lines.append("---\n\n## Architecture & Maintenance\n- **API**: `https://pleasant-ridge-gazette.vercel.app/api/archive`\n- **Source**: `https://pleasant-ridge-gazette.vercel.app/ops`\n")

    with open(BACKLOG_MD, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"[✓] Successfully updated: {BACKLOG_MD}")

if __name__ == "__main__":
    sync_archive()
