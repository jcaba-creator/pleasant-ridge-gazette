#!/usr/bin/env python3
"""
The Pleasant Ridge Gazette — Automated Multi-Store Grocery Procurement Engine
Autonomously pulls real-time shelf prices across the Leavenworth / Easton corridor:
  1. Fort Leavenworth Commissary (DeCA CLICK2GO / NCR Freshop REST API)
  2. Dillons (Kroger Calypso SSR Engine via curl_cffi)
  3. Price Chopper (Balls Foods Store #61 Native Circular API & Flipp Feed)

Updates data/groceries.json and public/data/groceries.json autonomously.
"""

import os
import sys
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from curl_cffi import requests

GAZETTE_DIR = r"g:\My Drive\pleasant-ridge-gazette"
DATA_JSON_PATH = os.path.join(GAZETTE_DIR, "data", "groceries.json")
PUBLIC_DATA_JSON_PATH = os.path.join(GAZETTE_DIR, "public", "data", "groceries.json")
DATA_JS_PATH = os.path.join(GAZETTE_DIR, "data", "groceries.js")
PUBLIC_DATA_JS_PATH = os.path.join(GAZETTE_DIR, "public", "data", "groceries.js")

# -------------------------------------------------------------
# 1. COMMISSARY INGESTION (NCR FRESHOP API - STORE 5878)
# -------------------------------------------------------------
COMMISSARY_BASE = "https://api.prd.freshop.retail.ncrgov.com/1/products"
COMMISSARY_APP_KEY = "deca"
COMMISSARY_STORE_ID = "5878"

COMMISSARY_UPCS = {
    "ground_beef": "20165900000",   # 80% Lean Ground Beef
    "eggs_dozen": "2862112398",     # Cal-Maine Sunups Large White Eggs 12 ct
    "whole_milk": "7206000117",     # Hiland Vitamin D Milk 1 gal
    "russet_potatoes": "470930000", # Russet Potatoes 5 lb
    "sandwich_bread": "84279811084" # Freedom's Choice White Bread 20 oz
}

def pull_commissary_prices():
    print("\n[1/3] Pulling Fort Leavenworth Commissary (Store 5878)...")
    results = {}
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    for item_key, upc in COMMISSARY_UPCS.items():
        url = f"{COMMISSARY_BASE}?app_key={COMMISSARY_APP_KEY}&store_id={COMMISSARY_STORE_ID}&q={upc}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                items = data.get("items", [])
                if items:
                    raw = str(items[0].get("price", "0")).replace("$", "").strip()
                    price = round(float(raw), 2)
                    results[item_key] = price
                    print(f"  + {item_key}: {items[0].get('name')} -> ${price:.2f}")
        except Exception as e:
            print(f"  ! Error for {item_key}: {e}")
    return results

def is_valid_staple_match(item_key, item_name, price):
    name = (item_name or "").lower()
    if item_key == "ground_beef":
        if any(bad in name for bad in ["patties", "patty", "organic", "grass-fed", "grass fed", "2 lb", "3 lb", "5 lb", "slider"]):
            return False
        return ("ground beef" in name or "80%" in name or "80/20" in name) and (3.00 <= price <= 7.00)
    elif item_key == "eggs_dozen":
        if any(bad in name for bad in ["18 ct", "18-ct", "24 ct", "30 ct", "60 ct", "organic", "pasture", "cage-free", "cage free", "liquid"]):
            return False
        return "egg" in name and (1.00 <= price <= 4.50)
    elif item_key == "whole_milk":
        if any(bad in name for bad in ["half gallon", "1/2 gal", "chocolate", "fairlife", "organic", "almond", "oat", "soy", "lactose", "pint", "quart"]):
            return False
        return "milk" in name and (2.00 <= price <= 5.50)
    elif item_key == "russet_potatoes":
        if any(bad in name for bad in ["yellow", "red", "gold", "bite", "sweet", "10 lb", "15 lb", "mashed"]):
            return False
        return "russet" in name and "potato" in name and (1.20 <= price <= 5.00)
    elif item_key == "sandwich_bread":
        if any(bad in name for bad in ["garlic", "knot", "oroweat", "artisan", "keto", "gluten", "sourdough", "cinnamon", "raisin", "french", "italian", "bun", "roll"]):
            return False
        return "bread" in name and ("white" in name or "sandwich" in name or "enriched" in name) and (1.00 <= price <= 3.50)
    return False

# -------------------------------------------------------------
# 2. DILLONS INGESTION (KROGER CALYPSO SSR VIA CURL_CFFI)
# -------------------------------------------------------------
DILLONS_QUERIES = {
    "ground_beef": "kroger 80/20 ground beef 16 oz",
    "eggs_dozen": "kroger large white eggs 12 ct",
    "whole_milk": "kroger vitamin d whole milk 1 gal",
    "russet_potatoes": "kroger russet potatoes 5 lb",
    "sandwich_bread": "kroger enriched white bread 20 oz"
}

def pull_dillons_prices():
    print("\n[2/3] Pulling Dillons Leavenworth (Kroger Calypso)...")
    results = {}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    for item_key, query in DILLONS_QUERIES.items():
        url = f"https://www.dillons.com/search?query={urllib.parse.quote(query)}"
        try:
            r = requests.get(url, headers=headers, impersonate="chrome120", timeout=12)
            tag = "__INITIAL_STATE__ = JSON.parse('"
            idx = r.text.find(tag)
            if idx != -1:
                idx += len(tag)
                raw = r.text[idx:r.text.rfind("');")].replace(r"\'", "'").replace(r'\\"', r'\"')
                data, _ = json.JSONDecoder().raw_decode(raw)
                prods = data.get("calypso", {}).get("useCases", {}).get("getProducts", {}).get("search-grid", {}).get("response", {}).get("data", {}).get("products", [])
                best_price = None
                best_desc = None
                for p in prods[:10]:
                    item_desc = p.get("item", {}).get("description", "")
                    sp = p.get("price", {}).get("storePrices", {})
                    promo = sp.get("promo", {}).get("defaultDescription")
                    regular = sp.get("regular", {}).get("defaultDescription")
                    price_str = promo or regular
                    if price_str:
                        clean_p = float(price_str.replace("$", "").replace(",", "").strip())
                        if is_valid_staple_match(item_key, item_desc, clean_p):
                            best_price = clean_p
                            best_desc = item_desc
                            break
                if best_price is not None:
                    results[item_key] = best_price
                    print(f"  + {item_key}: {best_desc} -> ${best_price:.2f}")
                else:
                    print(f"  - {item_key}: Preserving verified shelf baseline")
        except Exception as e:
            print(f"  ! Dillons error for {item_key}: {e}")
    return results

# -------------------------------------------------------------
# 3. PRICE CHOPPER INGESTION (STORE 61 NATIVE WEEKLY AD & FLIPP)
# -------------------------------------------------------------
PC_CIRCULAR_BASE = "https://www.mypricechopper.com/public/WeeklyAd"
PC_ADS_ENDPOINT = "https://www.mypricechopper.com/public/CurrentAdsForPreferredStore/61"
FLIPP_SEARCH = "https://backflipp.wishabi.com/flipp/items/search?postal_code=66048"

def pull_price_chopper_prices():
    print("\n[3/3] Pulling Price Chopper Leavenworth (Store #61 & Circular)...")
    results = {}
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    
    # 1. Check Store 61 active weekly circulars
    try:
        req = urllib.request.Request(PC_ADS_ENDPOINT, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            ads_data = json.loads(resp.read().decode("utf-8"))
            active_ads = ads_data.get("data", [])
            print(f"  Found {len(active_ads)} active circular ads for Leavenworth Store #61")
            for ad in active_ads[:3]:
                ad_id = ad.get("AdId")
                if not ad_id: continue
                ad_url = f"{PC_CIRCULAR_BASE}/{ad_id}"
                try:
                    with urllib.request.urlopen(urllib.request.Request(ad_url, headers=headers), timeout=10) as a_resp:
                        items_data = json.loads(a_resp.read().decode("utf-8")).get("data", {}).get("items", [])
                        for it in items_data:
                            title = it.get("Title", "")
                            p_str = str(it.get("AdPrice", "")).replace("$", "").strip()
                            try:
                                p_val = float(p_str.split()[0])
                            except Exception:
                                continue
                            for ik in ["ground_beef", "eggs_dozen", "whole_milk", "russet_potatoes", "sandwich_bread"]:
                                if ik not in results and is_valid_staple_match(ik, title, p_val):
                                    results[ik] = round(p_val, 2)
                except Exception:
                    pass
    except Exception as e:
        print(f"  ! PC Circular check: {e}")

    # 2. Check Flipp 66048 Price Chopper KC deals for any unfilled items
    staple_terms = {
        "ground_beef": "ground beef",
        "eggs_dozen": "large eggs",
        "whole_milk": "whole milk gallon",
        "russet_potatoes": "russet potatoes",
        "sandwich_bread": "white bread"
    }
    for item_key, q in staple_terms.items():
        if item_key in results: continue
        url = f"{FLIPP_SEARCH}&q={urllib.parse.quote(q)}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                f_data = json.loads(resp.read().decode("utf-8"))
                for it in f_data.get("items", []):
                    merchant = it.get("merchant_name") or it.get("merchant") or ""
                    if "price chopper" in merchant.lower():
                        price = it.get("current_price") or it.get("price")
                        if price is not None:
                            p_val = round(float(price), 2)
                            if is_valid_staple_match(item_key, it.get("name", ""), p_val):
                                results[item_key] = p_val
                                print(f"  + {item_key} (from PC Weekly Ad): {it.get('name')} -> ${results[item_key]:.2f}")
                                break
        except Exception:
            pass

    return results


def pull_flipp_store_prices(store_label, merchant_keyword):
    print(f"\n[*] Pulling {store_label} Leavenworth (66048 Feed)...")
    results = {}
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    staple_terms = {
        "ground_beef": "ground beef",
        "eggs_dozen": "large eggs",
        "whole_milk": "whole milk gallon",
        "russet_potatoes": "russet potatoes",
        "sandwich_bread": "white bread"
    }
    for item_key, q in staple_terms.items():
        url = f"{FLIPP_SEARCH}&q={urllib.parse.quote(q)}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                f_data = json.loads(resp.read().decode("utf-8"))
                for it in f_data.get("items", []):
                    merchant = it.get("merchant_name") or it.get("merchant") or ""
                    if merchant_keyword.lower() in merchant.lower():
                        price = it.get("current_price") or it.get("price")
                        if price is not None:
                            p_val = round(float(price), 2)
                            if is_valid_staple_match(item_key, it.get("name", ""), p_val):
                                results[item_key] = p_val
                                print(f"  + {item_key} ({store_label}): {it.get('name')} -> ${p_val:.2f}")
                                break
        except Exception:
            pass
    return results


def run_pipeline():
    print("=" * 68)
    print("  THE PLEASANT RIDGE GAZETTE — AUTOMATED GROCERY PROCUREMENT SWEEP")
    print("=" * 68)

    store_timestamps = {}

    comm_prices = pull_commissary_prices()
    store_timestamps["commissary"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    dillons_prices = pull_dillons_prices()
    store_timestamps["dillons"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    pc_prices = pull_price_chopper_prices()
    store_timestamps["price_chopper"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    aldi_prices = pull_flipp_store_prices("ALDI", "aldi")
    store_timestamps["aldi"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    walmart_prices = pull_flipp_store_prices("Walmart Supercenter", "walmart")
    store_timestamps["walmart"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not os.path.exists(DATA_JSON_PATH):
        print(f"[FATAL] Data file not found: {DATA_JSON_PATH}")
        sys.exit(1)

    with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    current_basket = data.setdefault("currentBasket", {})
    prices_map = current_basket.setdefault("prices", {})
    ts_map = current_basket.setdefault("storeTimestamps", {})

    # Update Commissary
    if comm_prices:
        c_map = prices_map.setdefault("commissary", {})
        for k, v in comm_prices.items(): c_map[k] = v

    # Update Dillons
    if dillons_prices:
        d_map = prices_map.setdefault("dillons", {})
        for k, v in dillons_prices.items(): d_map[k] = v

    # Update Price Chopper
    if pc_prices:
        pc_map = prices_map.setdefault("price_chopper", {})
        for k, v in pc_prices.items(): pc_map[k] = v

    # Update ALDI (preserve existing baseline for any item not in weekly promo circular)
    if aldi_prices:
        a_map = prices_map.setdefault("aldi", {})
        for k, v in aldi_prices.items(): a_map[k] = v

    # Update Walmart (preserve existing baseline for any item not in weekly promo circular)
    if walmart_prices:
        w_map = prices_map.setdefault("walmart", {})
        for k, v in walmart_prices.items(): w_map[k] = v

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    current_basket["publishedAt"] = now_iso
    for st_id, st_ts in store_timestamps.items():
        ts_map[st_id] = st_ts

    # Update ingestion mode descriptions and per-store timestamps
    for s in data.get("stores", []):
        sid = s.get("id")
        if sid in store_timestamps:
            s["lastUpdated"] = store_timestamps[sid]
        if sid == "commissary":
            s["ingestionMode"] = "DeCA Click2Go API (NCR Freshop native JSON)"
            s["isManual"] = False
        elif sid == "dillons":
            s["ingestionMode"] = "Kroger Calypso SSR Engine (Real-Time Shelf JSON)"
        elif sid == "price_chopper":
            s["ingestionMode"] = "Store #61 Native Circular API & Flipp Feed"

    # Save outputs
    for path in [DATA_JSON_PATH, PUBLIC_DATA_JSON_PATH]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[SAVED] {path}")

    js_content = f"// Pleasant Ridge Gazette - Grocery Data Sync\nwindow.GAZETTE_GROCERY_DATA = {json.dumps(data, indent=2)};\n"
    for js_path in [DATA_JS_PATH, PUBLIC_DATA_JS_PATH]:
        os.makedirs(os.path.dirname(js_path), exist_ok=True)
        with open(js_path, "w", encoding="utf-8") as f:
            f.write(js_content)
        print(f"[SAVED] {js_path}")

    print("\n[SUCCESS] Automated multi-store grocery sweep complete!")
    print("=" * 68)


if __name__ == "__main__":
    run_pipeline()
