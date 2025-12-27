const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

// ============================================================
// LOGIN + KEYSTROKE BIOMETRICS
// ============================================================

const passField = document.getElementById("pass");

let attemptsRemaining = 3;
let keyDownTimes = [];
let keyUpTimes = [];
let downKeyOrder = [];

// -------------------- Attempts Display --------------------
function updateAttemptsDisplay() {
    const attemptsEl = document.getElementById("attempts");
    if (attemptsEl) {
        attemptsEl.innerHTML = `Attempts: ${attemptsRemaining}`;
        if (attemptsRemaining === 1) attemptsEl.style.color = "#ff3333";
        else if (attemptsRemaining === 2) attemptsEl.style.color = "#ff9900";
    }
}

// -------------------- Keystroke Reset --------------------
function resetKeystrokeCapture() {
    keyDownTimes = [];
    keyUpTimes = [];
    downKeyOrder = [];
}

passField.addEventListener("focus", resetKeystrokeCapture);

// -------------------- Key Down --------------------
passField.addEventListener("keydown", (e) => {
    if (e.key.length === 1 && ![
        "Backspace", "Delete", "ArrowLeft", "ArrowRight",
        "Shift", "Control", "Alt", "Meta", "Tab", "Escape"
    ].includes(e.key)) {
        keyDownTimes.push(Date.now());
        downKeyOrder.push(e.key);
    }
});

// -------------------- Key Up --------------------
passField.addEventListener("keyup", (e) => {
    if (downKeyOrder.length > 0 && e.key === downKeyOrder[downKeyOrder.length - 1]) {
        keyUpTimes.push(Date.now());
    }
    if (e.key === "Enter") login();
});

// -------------------- Build Vectors --------------------
function buildKeystrokeVectors() {
    const n = Math.min(keyDownTimes.length, keyUpTimes.length, downKeyOrder.length);
    if (n !== 4) return { hold: [], flight: [] };

    const hold = [];
    for (let i = 0; i < n; i++) {
        hold.push((keyUpTimes[i] - keyDownTimes[i]) / 1000.0);
    }

    const flight = [0];
    for (let i = 1; i < n; i++) {
        flight.push((keyDownTimes[i] - keyDownTimes[i - 1]) / 1000.0);
    }

    return { hold, flight };
}

// -------------------- Loading UI --------------------
function showLoading() {
    let loading = document.getElementById("loading");
    if (!loading) {
        loading = document.createElement("div");
        loading.id = "loading";
        loading.innerHTML = '<div class="spinner"></div><p>Checking security...</p>';
        loading.style.cssText =
            "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);" +
            "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
            "color:white;z-index:1000;";
        document.body.appendChild(loading);
    }
    loading.style.display = "flex";
}

function hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
}

// -------------------- Login Function --------------------
async function login() {
    const username = document.getElementById("user").value;
    const password = document.getElementById("pass").value;

    const vectors = buildKeystrokeVectors();
    showLoading();

    try {
        const res = await fetch("http://127.0.0.1:5000/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username,
                password,
                keystroke_hold: vectors.hold,
                keystroke_flight: vectors.flight
            })
        });

        const data = await res.json();
        const resultBox = document.getElementById("result");

        await new Promise(resolve => setTimeout(resolve, 3000));
        hideLoading();

        if (data.status === "success") {
            resultBox.innerHTML = "LOGIN SUCCESS";
            resultBox.style.color = "lime";
            ipcRenderer.send("login-result", "success");
        } else {
            if (data.anomaly_detected) {
                showAnomalyAlert(data.anomaly_keystroke, data.anomaly_time);
                ipcRenderer.send("login-result", "anomaly");
            } else {
                resultBox.innerHTML = "WRONG PASSWORD";
                resultBox.style.color = "red";
                ipcRenderer.send("login-result", "failed");
            }

            document.getElementById("user").value = "";
            document.getElementById("pass").value = "";
            document.getElementById("pass").focus();
        }
    } catch (err) {
        console.error("FETCH ERROR:", err);
        hideLoading();
        alert("Cannot reach backend. Is app.py running?");
    } finally {
        resetKeystrokeCapture();
    }
}

// -------------------- Anomaly Alert --------------------
function showAnomalyAlert(keystrokeAnomaly, timeAnomaly) {
    let message = "-_- ANOMALY DETECTED!<br><br>";
    if (keystrokeAnomaly) message += " `_` Keystroke pattern mismatch<br>";
    if (timeAnomaly) message += " `_` Unusual login time<br>";
    message += "<br>Access Denied";

    const resultBox = document.getElementById("result");
    resultBox.innerHTML = message;
    resultBox.style.color = "red";
}

// ============================================================
// VAULT ENCRYPTION
// ============================================================

async function selectAndEncrypt() {
    try {
        const filePath = await ipcRenderer.invoke("open-file-dialog");
        if (!filePath) return alert("No file selected.");

        const data = fs.readFileSync(filePath);
        const filename = path.basename(filePath);

        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(data)]), filename);

        const res = await fetch("http://127.0.0.1:5000/encrypt-file", {
            method: "POST",
            body: form
        });

        const j = await res.json();
        if (j.status === "success") {
            alert("Encrypted and saved as: " + j.vault_filename);
        } else {
            alert("Encryption failed: " + (j.msg || "unknown"));
        }
    } catch (err) {
        console.error("Encrypt error:", err);
        alert("Encryption error: " + err.message);
    }
}

// ============================================================
// VAULT DECRYPTION (MODAL UI)
// ============================================================

async function decryptFromVault() {
    try {
        const resList = await fetch("http://127.0.0.1:5000/vault-list");
        const jl = await resList.json();
        if (jl.status !== "success") return alert("Failed to fetch vault list.");

        const files = jl.files;
        if (!files || files.length === 0) return alert("Vault is empty.");

        const modal = document.getElementById("vaultModal");
        const listUI = document.getElementById("vaultFileList");

        listUI.innerHTML = "";
        modal.style.display = "flex";

        files.forEach((file) => {
            const li = document.createElement("li");
            li.textContent = file;
            li.onclick = () => {
                modal.style.display = "none";
                decryptSelectedFile(file);
            };
            listUI.appendChild(li);
        });

        document.getElementById("vaultCancel").onclick = () =>
            (modal.style.display = "none");

    } catch (err) {
        console.error("Decrypt error:", err);
        alert("Decryption error: " + err.message);
    }
}

async function decryptSelectedFile(vaultFilename) {
    try {
        const res = await fetch("http://127.0.0.1:5000/decrypt-file", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ vault_filename: vaultFilename })
        });

        if (!res.ok) {
            const errj = await res.json().catch(() => ({}));
            return alert("Decrypt failed: " + (errj.msg || res.statusText));
        }

        const arrayBuffer = await res.arrayBuffer();

        let defaultName = vaultFilename.endsWith(".enc")
            ? vaultFilename.slice(0, -4)
            : vaultFilename;

        const savePath = await ipcRenderer.invoke(
            "save-file-dialog",
            defaultName
        );
        if (!savePath) return alert("Save cancelled.");

        fs.writeFileSync(savePath, Buffer.from(arrayBuffer));

        alert("Saved decrypted file: " + savePath);

    } catch (err) {
        console.error("Decrypt error:", err);
        alert("Decryption error: " + err.message);
    }
}
