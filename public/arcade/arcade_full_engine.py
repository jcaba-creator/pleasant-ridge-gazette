"""
ARCADE HORROR CABINET: KEY & DRAWER ESCAPE ENGINE
------------------------------------------------
Dependencies: pyserial (optional, only needed for physical hardware)
Run command: python arcade_full_engine.py
"""

import sys
import time
import threading
import queue
import random
from dataclasses import dataclass
from typing import Dict, List, Optional

# Attempt hardware serial import; fall back gracefully to simulation mode
try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


# ==========================================
# CONSTANTS & PROTOCOLS
# ==========================================
EVENT_KEY_INSERTED       = "KEY_INSERTED"        # e.g., KEY_INSERTED:drawer_04:key_abrasive
EVENT_DRAWER_OPEN_SLOW   = "DRAWER_OPEN_SMOOTH"  # Gentle pull under noise threshold
EVENT_DRAWER_OPEN_FAST   = "DRAWER_OPEN_RATTLE"  # Microswitch tripped: loud metallic scrape
EVENT_DIVERSION_CHUTE    = "DIVERSION_USED"      # Threw heavy bolt down chute
EVENT_KEY_PICKUP         = "KEY_PICKUP"          # Found and took a key
EVENT_KEY_DROP           = "KEY_DROP"            # Left a key on the magnet plate


class MonsterState:
    DISTANT       = "DISTANT PROWL"
    INVESTIGATING = "INVESTIGATING NOISE"
    HUNTING       = "TARGET LOCKED (CHARGING)"
    CAUGHT        = "LOCKDOWN - PLAYER CAUGHT"


@dataclass
class Drawer:
    drawer_id: str
    required_key_id: str
    clue_description: str
    item_inside: Optional[str] = None
    is_locked: bool = True
    is_open: bool = False


# ==========================================
# GAME ENGINE & STATE MACHINE
# ==========================================
class ArcadeEngine:
    def __init__(self, serial_port: Optional[str] = None, baud_rate: int = 115200):
        self.drawers: Dict[str, Drawer] = {}
        self.player_inventory: List[str] = []
        self.inventory_limit = 2
        
        # Monster Dynamics
        self.monster_state = MonsterState.DISTANT
        self.monster_distance = 30.0  # Meters (Game over at 0.0)
        self.noise_level = 0.0       # 0.0 to 100.0
        self.running = True
        
        # Concurrency & Event Queues
        self.event_queue: queue.Queue = queue.Queue()
        self.serial_port = serial_port
        self.baud_rate = baud_rate
        self.serial_conn = None

        self._init_scenario()

    def _init_scenario(self):
        """Builds out the three physical clue sets designed earlier."""
        self.drawers["drawer_01"] = Drawer(
            drawer_id="drawer_01",
            required_key_id="key_clock_0342",
            clue_description="Clockface position 03:42. Brass faceplate.",
            item_inside="blown_fuse_with_key"
        )
        self.drawers["drawer_02"] = Drawer(
            drawer_id="drawer_02",
            required_key_id="key_broken_fuse",
            clue_description="Electrical breaker section; unlit status bulb.",
            item_inside="copper_diversion_bolt"
        )
        self.drawers["drawer_03"] = Drawer(
            drawer_id="drawer_03",
            required_key_id="key_music_box",
            clue_description="Chimed handle (C-E-G-B tonal sequence).",
            item_inside="arcade_exit_key"
        )
        
        # Start player with the first subtle clue key nearby
        self.available_ground_keys = ["key_clock_0342"]

    # --- Sensor & Command Ingestion ---
    def push_raw_event(self, raw_line: str):
        """Parses lines like 'KEY_INSERTED:drawer_01:key_clock_0342' into the queue."""
        clean = raw_line.strip()
        if clean:
            self.event_queue.put(clean)

    def process_events(self):
        while not self.event_queue.empty():
            msg = self.event_queue.get_nowait()
            parts = msg.split(":")
            event_type = parts[0]
            
            if event_type == EVENT_KEY_PICKUP and len(parts) > 1:
                key_id = parts[1]
                if len(self.player_inventory) >= self.inventory_limit:
                    print(f"\n[!] INVENTORY FULL: Cannot carry more than {self.inventory_limit} keys.")
                else:
                    self.player_inventory.append(key_id)
                    print(f"\n[+] POCKETED: {key_id}. Current inventory: {self.player_inventory}")

            elif event_type == EVENT_KEY_DROP and len(parts) > 1:
                key_id = parts[1]
                if key_id in self.player_inventory:
                    self.player_inventory.remove(key_id)
                    print(f"\n[-] STAGED: Dropped {key_id} on the magnetic plate.")

            elif event_type == EVENT_KEY_INSERTED and len(parts) > 2:
                target_drawer = self.drawers.get(parts[1])
                used_key = parts[2]
                if target_drawer and target_drawer.is_locked:
                    if used_key == target_drawer.required_key_id:
                        target_drawer.is_locked = False
                        print(f"\n[TUMBLER CLICK] {target_drawer.drawer_id} unlocked smoothly.")
                    else:
                        print(f"\n[JAM] Wrong key for {target_drawer.drawer_id}! Metallic clatter.")
                        self.noise_level = min(100.0, self.noise_level + 15.0)

            elif event_type == EVENT_DRAWER_OPEN_SLOW and len(parts) > 1:
                d = self.drawers.get(parts[1])
                if d and not d.is_locked:
                    d.is_open = True
                    self.noise_level = min(100.0, self.noise_level + 3.0)
                    print(f"\n[DRAWER] {d.drawer_id} opened carefully. Revealed: {d.item_inside}")
                elif d and d.is_locked:
                    print(f"\n[LOCKED] Rattled the handle of {d.drawer_id} while locked.")
                    self.noise_level = min(100.0, self.noise_level + 8.0)

            elif event_type == EVENT_DRAWER_OPEN_FAST and len(parts) > 1:
                d = self.drawers.get(parts[1])
                if d:
                    d.is_open = True
                    self.noise_level = min(100.0, self.noise_level + 40.0)
                    print(f"\n[ALARM] {d.drawer_id} PULLED TOO FAST! Metal rails squealed violently.")

            elif event_type == EVENT_DIVERSION_CHUTE:
                print("\n[CLATTER] Heavy metal bolt thrown down chute. Acoustic signature relocated!")
                self.monster_distance = min(35.0, self.monster_distance + 14.0)
                self.monster_state = MonsterState.DISTANT

    # --- Frame Update / Monster Tick ---
    def update(self, dt: float):
        # 1. Passive acoustic dissipation
        self.noise_level = max(0.0, self.noise_level - (4.0 * dt))

        # 2. State machine evaluation
        if self.noise_level >= 50.0:
            self.monster_state = MonsterState.HUNTING
            approach_speed = 4.0  # m/s
        elif self.noise_level >= 15.0:
            self.monster_state = MonsterState.INVESTIGATING
            approach_speed = 1.8  # m/s
        else:
            self.monster_state = MonsterState.DISTANT
            approach_speed = 0.5  # m/s

        # 3. Distance reduction
        self.monster_distance -= approach_speed * dt

        # 4. End Condition
        if self.monster_distance <= 0.0:
            self.monster_distance = 0.0
            self.monster_state = MonsterState.CAUGHT
            self.running = False

    def get_hardware_telemetry(self) -> dict:
        """Returns values to drive cabinet relays, PWM lights, and haptic subwoofers."""
        return {
            "distance_m": round(self.monster_distance, 1),
            "noise_pct": int(self.noise_level),
            "state": self.monster_state,
            "cabinet_light_brightness": max(5, int((self.monster_distance / 30.0) * 100)),
            "floor_subwoofer_freq_hz": max(25, 90 - int(self.monster_distance * 2)),
            "strobe_active": self.monster_state == MonsterState.HUNTING
        }


# ==========================================
# HARDWARE SERIAL WORKER THREAD
# ==========================================
def serial_reader_thread(engine: ArcadeEngine, port: str, baud: int):
    try:
        ser = serial.Serial(port, baud, timeout=1.0)
        print(f"[HARDWARE] Connected to Arduino controller on {port}")
        while engine.running:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                engine.push_raw_event(line)
        ser.close()
    except Exception as e:
        print(f"[HARDWARE ERROR] Serial connection failure: {e}")


# ==========================================
# KEYBOARD SIMULATOR THREAD
# ==========================================
def terminal_input_thread(engine: ArcadeEngine):
    """Allows testing all cabinet sensors via terminal without physical wires."""
    time.sleep(0.5)
    print("\n--- KEYBOARD SIMULATOR COMMANDS ---")
    print(" 1 : Take key_clock_0342")
    print(" 2 : Insert key_clock_0342 into drawer_01")
    print(" 3 : Open drawer_01 SLOWLY (Silent)")
    print(" 4 : Open drawer_01 RAPIDLY (Rattle microswitch trips!)")
    print(" 5 : Throw metal bolt down diversion chute")
    print(" q : Quit")
    print("-----------------------------------\n")

    while engine.running:
        try:
            cmd = input().strip()
            if cmd == "1":
                engine.push_raw_event(f"{EVENT_KEY_PICKUP}:key_clock_0342")
            elif cmd == "2":
                engine.push_raw_event(f"{EVENT_KEY_INSERTED}:drawer_01:key_clock_0342")
            elif cmd == "3":
                engine.push_raw_event(f"{EVENT_DRAWER_OPEN_SLOW}:drawer_01")
            elif cmd == "4":
                engine.push_raw_event(f"{EVENT_DRAWER_OPEN_FAST}:drawer_01")
            elif cmd == "5":
                engine.push_raw_event(EVENT_DIVERSION_CHUTE)
            elif cmd.lower() == "q":
                engine.running = False
                break
        except (EOFError, KeyboardInterrupt):
            engine.running = False
            break


# ==========================================
# ENTRYPOINT & RUNNER
# ==========================================
def main():
    # If using physical Arduino, specify port (e.g., 'COM3' or '/dev/ttyUSB0')
    target_serial_port = None
    if len(sys.argv) > 1:
        target_serial_port = sys.argv[1]

    engine = ArcadeEngine(serial_port=target_serial_port)

    # Spawn Hardware Serial Listener if requested and available
    if target_serial_port and SERIAL_AVAILABLE:
        s_thread = threading.Thread(
            target=serial_reader_thread,
            args=(engine, engine.serial_port, engine.baud_rate),
            daemon=True
        )
        s_thread.start()

    # Always spawn terminal input thread for controls/debugging
    input_thread = threading.Thread(target=terminal_input_thread, args=(engine,), daemon=True)
    input_thread.start()

    # Main Game Loop (~10 ticks per second)
    last_time = time.time()
    try:
        while engine.running:
            now = time.time()
            dt = now - last_time
            last_time = now

            engine.process_events()
            engine.update(dt)

            telem = engine.get_hardware_telemetry()
            status_line = (
                f"\r[STATUS] {telem['state']:<26} | "
                f"Dist: {telem['distance_m']:>4.1f}m | "
                f"Noise: {telem['noise_pct']:>3d}% | "
                f"Light: {telem['cabinet_light_brightness']:>3d}% | "
                f"Bass: {telem['floor_subwoofer_freq_hz']}Hz"
            )
            sys.stdout.write(status_line)
            sys.stdout.flush()

            time.sleep(0.1)

    except KeyboardInterrupt:
        pass

    # Post-Loop State / Lockdown Screen
    print("\n")
    if engine.monster_distance <= 0.0:
        print("=" * 60)
        print("          CABINET STATUS: COMPLETE LOCKDOWN")
        print("        THE ENTITY REACHED THE BREAKER VAULT")
        print("=" * 60)
    else:
        print("[SHUTDOWN] Engine terminated cleanly.")


if __name__ == "__main__":
    main()
