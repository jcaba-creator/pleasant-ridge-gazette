#!/usr/bin/env python3
"""
The Pleasant Ridge Gazette — Automated Fort Leavenworth Commissary Ingestion Engine
Discovers and extracts real-time grocery prices directly from the Defense Commissary
Agency's (DeCA) Commissary CLICK2GO production backend (NCR Freshop REST API).

Store Metadata:
  Store ID: 5878
  Store Number: 2610
  Address: 310 Kansas Ave, Bldg 691, Fort Leavenworth, KS 66027
  API Platform: NCR Freshop (asset.prd.freshop.retail.ncrgov.com)
  Authentication: Public app_key="deca" (No CAC / Military login required for catalog)
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime

GAZETTE_DIR = r"g:\My Drive\pleasant-ridge-gazette"
DATA_JSON_PATH = os.path.join(GAZETTE_DIR, "data", "groceries.json")
PUBLIC_DATA_JSON_PATH = os.path.join(GAZETTE_DIR, "public", "data", "groceries.json")
DATA_JS_PATH = os.path.join(GAZETTE_DIR, "data", "groceries.js")
PUBLIC_DATA_JS_PATH = os.path.join(GAZETTE_DIR, "public", "data", "groceries.js")

API_BASE = "https://api.prd.freshop.retail.ncrgov.com/1/products"
APP_KEY = "deca"
STORE_ID = "5878"

# Target staples mapped to exact UPCs and fallbacks in the Fort Leavenworth inventory
COMMISSARY_SKUS = {
    "ground_beef": {
        "primary_upc": "20165900000",
        "description": "80% Lean Ground Beef (1 lb)",
        "query_fallback": "80% lean ground beef"
    },
    "eggs_dozen": {
        "primary_upc": "2862112398",
        "description": "Cal-Maine Sunups Grade A Large White Eggs 12 ct",
        "query_fallback": "large white eggs 12 ct"
    },
    "whole_milk": {
        "primary_upc": "7206000117",
        "description": "Hiland Vitamin D Milk 1 gal jug",
        "query_fallback": "Hiland Vitamin D Milk 1 gal"
    },
    "russet_potatoes": {
        "primary_upc": "470930000",
        "description": "Russet Potatoes 5 lb bag",
        "query_fallback": "Russet Potatoes 5 lb"
    },
    "sandwich_bread": {
        "primary_upc": "84279811084",
        "description": "Freedom's Choice White Bread 20 oz",
        "query_fallback": "Freedom's Choice White Bread"
    }
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}


def fetch_freshop_item(query_term):
    """Query Freshop REST API by UPC or description."""
    url = f"{API_BASE}?app_key={APP_KEY}&store_id={STORE_ID}&q={urllib.parse.quote(query_term)}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status == 200:
                body = json.loads(resp.read().decode("utf-8"))
                items = body.get("items", [])
                if items:
                    return items[0]
    except Exception as e:
        print(f"  [WARN] Request failed for '{query_term}': {e}", file=sys.stderr)
    return None


def parse_price(item_obj):
    """Cleanly extract numeric float price from Freshop item object."""
    raw = item_obj.get("price") or item_obj.get("unit_price") or "0"
    raw_str = str(raw).replace("$", "").replace(",", "").strip()
    try:
        return round(float(raw_str), 2)
    except ValueError:
        return None


def run_commissary_ingestion():
    print("=" * 68)
    print("  THE PLEASANT RIDGE GAZETTE — COMMISSARY PROCUREMENT INGESTION")
    print("  Target: Fort Leavenworth Commissary (Store ID: 5878, DeCA Click2Go)")
    print("=" * 68)

    live_prices = {}

    for item_key, meta in COMMISSARY_SKUS.items():
        print(f"-> Pulling {item_key} ({meta['description']})...")
        item = fetch_freshop_item(meta["primary_upc"])

        if not item and meta.get("query_fallback"):
            print(f"   [Fallback] Searching query '{meta['query_fallback']}'...")
            item = fetch_freshop_item(meta["query_fallback"])

        if item:
            price = parse_price(item)
            name = item.get("name", "Unknown Item")
            upc = item.get("upc", "N/A")
            live_prices[item_key] = price
            print(f"   [OK] {name} => ${price:.2f} (UPC: {upc})")
        else:
            print(f"   [ERROR] Could not resolve price for {item_key}!")
            live_prices[item_key] = None

    # Load existing data
    if not os.path.exists(DATA_JSON_PATH):
        print(f"[FATAL] Data file not found: {DATA_JSON_PATH}")
        sys.exit(1)

    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Update Commissary prices in current basket
    current_basket = data.setdefault("currentBasket", {})
    prices_map = current_basket.setdefault("prices", {})
    comm_prices = prices_map.setdefault("commissary", {})

    updated_count = 0
    for k, v in live_prices.items():
        if v is not None:
            comm_prices[k] = v
            updated_count += 1

    current_basket["publishedAt"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # Update ingestion mode indicator
    for s in data.get("stores", []):
        if s.get("id") == "commissary":
            s["ingestionMode"] = "DeCA Click2Go API (NCR Freshop native JSON)"
            s["isManual"] = False

    # Save to both data/groceries.json and public/data/groceries.json
    for path in [DATA_JSON_PATH, PUBLIC_DATA_JSON_PATH]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[SAVED] {path}")

    # Also sync data/groceries.js and public/data/groceries.js
    js_content = f"// Pleasant Ridge Gazette - Grocery Data Sync\nwindow.GAZETTE_GROCERY_DATA = {json.dumps(data, indent=2)};\n"
    for js_path in [DATA_JS_PATH, PUBLIC_DATA_JS_PATH]:
        os.makedirs(os.path.dirname(js_path), exist_ok=True)
        with open(js_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"[SAVED] {js_path}")

    print("\n[SUCCESS] Fort Leavenworth Commissary prices updated successfully!")
    print(f"Updated {updated_count}/{len(COMMISSARY_SKUS)} items.")
    print("=" * 68)


if __name__ == "__main__":
    run_commissary_ingestion()
