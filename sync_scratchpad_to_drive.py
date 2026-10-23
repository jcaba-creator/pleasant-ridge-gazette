"""
sync_scratchpad_to_drive.py
Autonomous Cloud-to-Drive Field Scratchpad Ingestion Engine
Fetches mobile and office observations logged on Vercel or GitHub Pages,
writes to Google Drive telemetry, and compiles into 00_INBOX for agent actioning.
"""
import os
import sys
import json
import urllib.request
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(r"G:\My Drive")
TELEMETRY_DIR = BASE_DIR / "pleasant-ridge-gazette" / "telemetry"
TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)

LIVE_JSON = TELEMETRY_DIR / "field_scratchpad_live.json"
INBOX_MD = BASE_DIR / "[ROOT]_FarmOps_Automation_Engine" / "00_INBOX" / "FIELD_SCRATCHPAD_INBOX.md"
VAULT_BACKUP = BASE_DIR / "workspace_knowledge_vault" / "field_scratchpad_archive.json"

API_URL = "https://pleasant-ridge-gazette.vercel.app/api/scratchpad"

def sync():
    print(f"[*] Querying central cloud scratchpad relay: {API_URL}")
    req = urllib.request.Request(API_URL, headers={"User-Agent": "Bold-Bovine-Drive-Sync/2.0"})
    
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status != 200:
                print(f"[!] Server returned HTTP {resp.status}")
                return
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[!] Cloud fetch note ({API_URL}): {e}")
        return

    items = data.get("items", [])
    print(f"[+] Retrieved {len(items)} items from central relay.")

    # 1. Save live JSON telemetry
    with open(LIVE_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
    print(f"[+] Saved live telemetry to {LIVE_JSON}")

    # 2. Backup to Vault
    VAULT_BACKUP.parent.mkdir(parents=True, exist_ok=True)
    with open(VAULT_BACKUP, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

    # 3. Compile Master Markdown for 00_INBOX
    now_str = datetime.now().strftime("%Y-%m-%d %I:%M %p")
    active_items = [i for i in items if i.get("status") != "resolved"]
    resolved_items = [i for i in items if i.get("status") == "resolved"]
    urgent_items = [i for i in active_items if i.get("urgency") == "urgent"]

    md = []
    md.append("# Bold Bovine OS — Field Scratchpad & Mobile Observations Inbox\n")
    md.append(f"> **Authoritative Source:** Synchronized from Central Cloud Relay (`{API_URL}`).\n")
    md.append(f"> **Last Ingestion Run:** {now_str} · Easton Field Ops\n")
    md.append(f"> **Active Field Observations:** {len(active_items)} | **Urgent Items:** {len(urgent_items)} | **Resolved:** {len(resolved_items)}\n\n")
    md.append("---\n\n")

    # ZONE TELEMETRY SUMMARY
    zones = ["Mobile / Vehicles", "Shop / Garage", "Pastures / Land", "Office / Desk", "Home / Interior"]
    md.append("## 📍 Observations by Primary Operating Zone\n\n")
    md.append("| Primary Zone | Active Count | Urgent Count | Next Horizon |\n")
    md.append("| :--- | :---: | :---: | :--- |\n")
    for z in zones:
        z_active = [i for i in active_items if i.get("zone") == z]
        z_urgent = [i for i in z_active if i.get("urgency") == "urgent"]
        horizons = list(set(i.get("sprint", "Backlog") for i in z_active))
        h_str = ", ".join(horizons) if horizons else "None"
        md.append(f"| **{z}** | {len(z_active)} | {len(z_urgent)} | {h_str} |\n")
    md.append("\n---\n\n")

    # ATOMIC TASKS FOR BOLD BOVINE LEDGER
    md.append("## 📋 Decomposed Atomic Tasks (Ready for Bold Bovine Ledger)\n\n")
    if not active_items:
        md.append("*No active field observations pending dispatch.*\n\n")
    else:
        for item in active_items:
            zone = item.get("zone", "Mobile / Vehicles")
            op = item.get("operator", "Josh")
            sprint = item.get("sprint", "🌱 Spring 2027")
            text = item.get("text", "").replace("\n", " ").strip()
            date_logged = item.get("timestamp", "")[:10]
            urgency_tag = " [URGENT]" if item.get("urgency") == "urgent" else ""
            md.append(f"* [ ] Inspect / Service: {text}{urgency_tag} | Zone: {zone} | Assigned: {op} | Sprint: {sprint} | Logged: {date_logged}\n")
        md.append("\n")

    # DETAILED AUDIT TABLE
    md.append("## 📝 Complete Ingested Field Log\n\n")
    md.append("| Status | Date | Zone | Sprint | Operator | Page / Device | Observation Note |\n")
    md.append("| :---: | :--- | :--- | :--- | :---: | :--- | :--- |\n")
    for item in items:
        status_icon = "🟢" if item.get("status") != "resolved" else "☑️"
        date_short = item.get("timestamp", "")[:10]
        z = item.get("zone", "Field")
        sp = item.get("sprint", "General")
        op = item.get("operator", "Josh")
        page = item.get("pagePath", "web")
        text = item.get("text", "").replace("|", "-").replace("\n", " ")
        md.append(f"| {status_icon} | {date_short} | **{z}** | {sp} | {op} | `{page}` | {text} |\n")

    with open(INBOX_MD, "w", encoding="utf-8") as f:
        f.write("".join(md))
    print(f"[+] Compiled Master Field Inbox -> {INBOX_MD}")
    print("[SUCCESS] Field scratchpad synchronization complete.")

if __name__ == "__main__":
    sync()
