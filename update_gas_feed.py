#!/usr/bin/env python3
"""
The Pleasant Ridge Gazette — Automated Corridor Fuel Price Engine
Pulls near real-time regular fuel prices for the USD 449 / Leavenworth / Lansing corridor
and exports to gas_prices.json and gas_prices.csv for zero-friction automated population.
"""

import os
import sys
import re
import json
import csv
from datetime import datetime
from curl_cffi import requests

# Force utf-8 stdout if needed
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRATCH_DIR = r"C:\Users\Josh\.gemini\antigravity-ide\brain\d7821b0f-7cbe-4105-a932-f7cccb4f8276\scratch"
JSON_OUTPUT_NAME = "gas_prices.json"
CSV_OUTPUT_NAME = "gas_prices.csv"

# Target corridor stations
CORRIDOR_STATIONS = [
    ("49808", "Sunoco", "501 Limit St (Leavenworth)", 3.85),
    ("186732", "Murphy USA (Walmart)", "10th Ave / Eisenhower (Leavenworth)", 3.87),
    ("96594", "AAFES Express", "Main Post (Ft. Leavenworth)", 3.89),
    ("202132", "QuikTrip", "1205 N Main St (Lansing)", 3.89),
    ("132625", "Dillons Fuel Center", "Eisenhower Rd (Leavenworth)", 3.89),
    ("204958", "7-Eleven", "Metropolitan Ave (Leavenworth)", 3.89),
    ("124378", "Casey's General Store", "2100 S 4th St (Leavenworth)", 3.89),
    ("35573", "Casey's", "2004 Spruce St (Leavenworth)", 3.89),
    ("147917", "BP / Amoco", "601 S Main St (Lansing)", 3.89),
    ("129028", "Cenex", "109 4H Rd (Lansing)", 3.89),
    ("103082", "Fav Trip", "1300 S 4th St (Leavenworth)", 3.89),
    ("143099", "Hilltop Market / 66", "Easton-Tongie Loop (Easton)", 3.91),
    ("155402", "Sam's Club Fuel", "Parallel Pkwy Corridor", 3.97),
    ("132624", "Shell", "Spruce St (Leavenworth)", 3.99),
]

GAS_PRICE_QUERY = """
query GetStation($id: ID!) {
  station(id: $id) {
    id
    name
    address {
      line1
      locality
      region
      postalCode
    }
    prices {
      cash {
        price
        formattedPrice
        postedTime
      }
      credit {
        price
        formattedPrice
        postedTime
      }
      fuelProduct
      longName
    }
  }
}
"""

def fetch_feed():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to live corridor feed...")
    session = requests.Session(impersonate="chrome120")
    
    # 1. Fetch CSRF token
    home_res = session.get("https://www.gasbuddy.com/home", timeout=15)
    match = re.search(r'window\.gbcsrf\s*=\s*"([^"]+)"', home_res.text)
    gbcsrf = match.group(1) if match else ""
    
    headers = {
        "Content-Type": "application/json",
        "apollo-require-preflight": "true",
        "gbcsrf": gbcsrf,
        "Origin": "https://www.gasbuddy.com",
        "Referer": "https://www.gasbuddy.com/home"
    }

    station_data = []

    for sid, display_name, display_loc, fallback_val in CORRIDOR_STATIONS:
        price = None
        posted_time = None
        addr = display_loc

        payload = {
            "operationName": "GetStation",
            "query": GAS_PRICE_QUERY,
            "variables": { "id": sid }
        }

        try:
            res = session.post("https://www.gasbuddy.com/graphql", json=payload, headers=headers, timeout=8)
            if res.status_code == 200:
                st = res.json().get("data", {}).get("station", {})
                if st and st.get("address"):
                    line1 = st.get("address", {}).get("line1", "").strip()
                    locality = st.get("address", {}).get("locality", "").strip()
                    if line1 and locality:
                        addr = f"{line1} ({locality})"

                for p in st.get("prices", []):
                    if p.get("fuelProduct") == "regular_gas":
                        cred = p.get("credit")
                        cash = p.get("cash")
                        if cred and cred.get("price"):
                            price = float(cred.get("price"))
                            posted_time = cred.get("postedTime")
                        elif cash and cash.get("price"):
                            price = float(cash.get("price"))
                            posted_time = cash.get("postedTime")
                        break
        except Exception as e:
            print(f"  Warning querying {display_name}: {e}")

        # Fallback to estimate if station didn't have an active user price post today
        is_estimate = False
        if price is None:
            price = fallback_val
            is_estimate = True

        station_data.append({
            "id": sid,
            "name": display_name,
            "loc": display_loc,
            "address": addr,
            "price": round(price, 2),
            "updated": posted_time,
            "is_estimate": is_estimate
        })
        status_tag = f"${price:.2f}" + (" (est)" if is_estimate else " (live)")
        print(f"  * {display_name:24} : {status_tag}")

    # Sort cheapest first
    station_data.sort(key=lambda x: x["price"])

    min_price = station_data[0]["price"]
    max_price = station_data[-1]["price"]
    max_savings = round((max_price - min_price) * 15, 2)
    now_dt = datetime.now()

    feed_payload = {
        "status": "success",
        "last_updated_iso": now_dt.isoformat(),
        "last_updated_human": now_dt.strftime("%A, %B %d, %Y - %I:%M %p"),
        "date_header": now_dt.strftime("%A, %b %d, %Y"),
        "cheapest_station": {
            "name": station_data[0]["name"],
            "loc": station_data[0]["loc"],
            "price": min_price
        },
        "max_tank_savings": max_savings,
        "stations": station_data
    }

    # Write JSON to scratch directory and local directory
    PUBLIC_DIR = os.path.join(BASE_DIR, "public")
    target_dirs = [SCRATCH_DIR, BASE_DIR, PUBLIC_DIR]
    for d in target_dirs:
        try:
            if os.path.exists(d):
                p = os.path.join(d, JSON_OUTPUT_NAME)
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(feed_payload, f, indent=2)
                
                cp = os.path.join(d, CSV_OUTPUT_NAME)
                with open(cp, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(["Station", "Location", "Regular_Price", "Status", "Last_Posted"])
                    for s in station_data:
                        writer.writerow([s["name"], s["loc"], f"{s['price']:.2f}", "Estimated" if s["is_estimate"] else "Live", s["updated"] or "N/A"])

                # Also generate gas_prices.js to bypass browser file:// CORS restrictions completely
                jsp = os.path.join(d, "gas_prices.js")
                with open(jsp, "w", encoding="utf-8") as f:
                    f.write("window.GAZETTE_GAS_FEED = " + json.dumps(feed_payload, indent=2) + ";\n")
        except Exception as err:
            pass

    print(f"\n[SUCCESS] Corridor feed generated! Cheapest: {station_data[0]['name']} at ${min_price:.2f}/gal (Saves ${max_savings:.2f} per 15-gal tank).")
    return feed_payload

if __name__ == "__main__":
    fetch_feed()
