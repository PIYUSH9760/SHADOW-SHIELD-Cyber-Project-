from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
import os
import datetime
import traceback
import math
from cryptography.fernet import Fernet
import io

# --------------------------
# INITIALIZE FLASK
# --------------------------
app = Flask(__name__)
CORS(app)

REAL_USER = "Piyush"
REAL_PASS = "1234"

# --------------------------
# PATHS AND DIRECTORIES
# --------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "user_data.json")

VAULT_DIR = os.path.join(BASE_DIR, "vault")
KEY_FILE = os.path.join(VAULT_DIR, "key.key")

# --------------------------
# ENSURE VAULT + KEY EXISTS
# --------------------------
def ensure_vault_and_key():
    if not os.path.exists(VAULT_DIR):
        os.makedirs(VAULT_DIR, exist_ok=True)

    if not os.path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as k:
            k.write(key)

def load_key():
    ensure_vault_and_key()
    with open(KEY_FILE, "rb") as k:
        return k.read()

# --------------------------
# USER DATA FUNCTIONS
# --------------------------
def ensure_data_file():
    default = {"last_login_hour": None, "hold_avg": None, "flight_avg": None}

    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump(default, f)
        return default

    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except:
        with open(DATA_FILE, "w") as f:
            json.dump(default, f)
        return default

def load_data():
    return ensure_data_file()

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# --------------------------
# EUCLIDEAN DISTANCE
# --------------------------
def euclidean_distance(vec1, vec2):
    if len(vec1) != len(vec2):
        return float("inf")
    s = sum((x - y) ** 2 for x, y in zip(vec1, vec2))
    return math.sqrt(s) / len(vec1)

# --------------------------
# KEYSTROKE BIOMETRIC LOGIN
# --------------------------
@app.route("/login", methods=["POST"])
def login():
    try:
        payload = request.get_json(force=True, silent=True) or {}

        username = payload.get("username")
        password = payload.get("password")

        hold = payload.get("keystroke_hold") or []
        flight = payload.get("keystroke_flight") or []

        # Convert to float
        try:
            hold = [float(x) for x in hold]
        except:
            hold = []
        try:
            flight = [float(x) for x in flight]
        except:
            flight = []

        stored = load_data()
        anomaly_time = False
        anomaly_keystroke = False

        if username == REAL_USER and password == REAL_PASS:

            # Time check
            now_hour = datetime.datetime.now().hour
            last_hour = stored.get("last_login_hour")

            if last_hour is None:
                stored["last_login_hour"] = now_hour
            else:
                if int(last_hour) != now_hour:
                    anomaly_time = True
                stored["last_login_hour"] = now_hour

            # Keystroke biometric check
            if len(hold) != 4 or len(flight) != 4:
                anomaly_keystroke = True
            else:
                hold_avg = stored.get("hold_avg")
                flight_avg = stored.get("flight_avg")

                if hold_avg is None or flight_avg is None:
                    stored["hold_avg"] = hold
                    stored["flight_avg"] = flight
                else:
                    hold_dist = euclidean_distance(hold, hold_avg)
                    flight_dist = euclidean_distance(flight, flight_avg)

                    combined = (hold_dist + flight_dist) / 2
                    anomaly_keystroke = combined > 0.2  # Strict threshold

            save_data(stored)

            if anomaly_keystroke or anomaly_time:
                return jsonify({
                    "status": "failed",
                    "anomaly_detected": True,
                    "anomaly_keystroke": anomaly_keystroke,
                    "anomaly_time": anomaly_time
                })

            return jsonify({
                "status": "success",
                "anomaly_detected": False
            })

        return jsonify({"status": "failed"})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "msg": str(e)}), 500

# --------------------------
# ENCRYPT FILE (Vault)
# --------------------------
@app.route("/encrypt-file", methods=["POST"])
def encrypt_file():
    try:
        if "file" not in request.files:
            return jsonify({"status": "error", "msg": "No file uploaded"}), 400

        uploaded = request.files["file"]
        orig_name = uploaded.filename
        content = uploaded.read()

        ensure_vault_and_key()
        key = load_key()
        f = Fernet(key)

        encrypted = f.encrypt(content)

        safe_name = orig_name.replace("/", "_")
        vault_path = os.path.join(VAULT_DIR, safe_name + ".enc")

        if os.path.exists(vault_path):
            ts = int(datetime.datetime.now().timestamp())
            vault_path = os.path.join(VAULT_DIR, f"{safe_name}_{ts}.enc")

        with open(vault_path, "wb") as vf:
            vf.write(encrypted)

        return jsonify({"status": "success", "vault_filename": os.path.basename(vault_path)})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "msg": str(e)}), 500

# --------------------------
# LIST VAULT FILES
# --------------------------
@app.route("/vault-list", methods=["GET"])
def vault_list():
    ensure_vault_and_key()
    files = [
        f for f in os.listdir(VAULT_DIR)
        if f.endswith(".enc") and f != "key.key"
    ]
    return jsonify({"status": "success", "files": files})

# --------------------------
# DECRYPT FILE
# --------------------------
@app.route("/decrypt-file", methods=["POST"])
def decrypt_file():
    try:
        payload = request.get_json(force=True, silent=True) or {}
        vault_filename = payload.get("vault_filename")

        vault_path = os.path.join(VAULT_DIR, vault_filename)
        if not os.path.exists(vault_path):
            return jsonify({"status": "error", "msg": "File not found"}), 404

        key = load_key()
        f = Fernet(key)

        with open(vault_path, "rb") as vf:
            encrypted = vf.read()

        decrypted = f.decrypt(encrypted)

        orig_name = vault_filename.replace(".enc", "")

        bio = io.BytesIO(decrypted)
        bio.seek(0)
        return send_file(
            bio,
            as_attachment=True,
            download_name=orig_name,
            mimetype="application/octet-stream"
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "msg": str(e)}), 500

# --------------------------
# RUN SERVER
# --------------------------
if __name__ == "__main__":
    ensure_vault_and_key()
    ensure_data_file()
    app.run(host="127.0.0.1", port=5000, debug=False)
