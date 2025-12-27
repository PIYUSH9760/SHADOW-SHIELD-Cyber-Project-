# 🛡️ SHADOW-SHIELD
## Anomaly-Aware Authentication & Secure Encryption Vault

Shadow-Shield is a cybersecurity-based local desktop application that identifies whether the person logging in is the legitimate user or an anomaly even if the correct password is entered. It analyzes typing behavior, login timing, keystroke dynamics, and deviation patterns. If the behavior does not match the trained profile, the system initiates retry attempts and eventually enters Freeze Mode.

After 3 failed anomaly checks:
• ❄️ The system enters Freeze Mode
• 🔐 The vault becomes inaccessible
• 📧 A recovery passcode is sent to the legitimate user’s email ID

It also includes a secure encrypted file vault where files are encrypted using Fernet (AES-based symmetric encryption).

---

## ✨ Features
- Behavioral authentication (typing speed, keystroke intervals, login time)
- Suspicious login detection with anomaly score
- 3 failed attempts → Freeze Mode (full lock screen)
- Email alert to real user with unlock passcode
- Local encryption vault for file storage (Fernet)
- Offline operation except for email alert
- No cloud storage / No third-party tracking
- Suitable for cybersecurity research and personal security

---

## 🧠 System Flow
Normal Login → Behavior matches → Dashboard + Vault access

Behavior mismatch → Retry (3 attempts)

3 fails:
→ Freeze Mode (lock screen)
→ Email sent to owner with passcode

Owner enters passcode → System unlocks

---

## 📁 Project Structure
Shadow-Shield/
│
├─ backend/ (Flask API + anomaly detection + encryption)
│   ├─ app.py
│   ├─ vault/ (encrypted files stored here)
│   └─ user_data.json (local user data)
│
├─ frontend/ (Electron UI)
│   ├─ index.html
│   ├─ renderer.js
│   └─ style.css
│
├─ freeze.html (Freeze Mode lockscreen)
├─ main.js (Electron entry file)
└─ README.md

---

## 📦 Installation (User Guide)

### Backend Setup (Python 3.10+)
cd backend
pip install -r requirements.txt
python app.py

### Frontend Setup (Node.js 18+)
cd frontend
npm install          ← because node_modules is removed before upload
npm start

---

## ⚙️ Email Alert Setup (IMPORTANT)
Inside backend/app.py, update:

EMAIL_ADDRESS = "your_email@gmail.com"
EMAIL_PASSWORD = "your_email_app_password"

Do NOT use your real login password.  
For Gmail → enable App Passwords in Google Account Security.

---

## 🔐 Requirements (requirements.txt)
flask
flask-cors
cryptography
requests
email-validator

---

## 🚫 .gitignore (files that must NOT be uploaded)
backend/vault/key.key
backend/vault/*.enc
backend/user_data.json
node_modules/
__pycache__/
.DS_Store
.env

---

## 🎯 Use Cases
- Protecting a device even if password is leaked
- Shared computer environments
- Preventing impersonation or shoulder-surfing attacks
- Cybersecurity research & portfolio project
- Privacy-sensitive personal data protection

---

## 💡 Benefits
✔ Protection beyond passwords  
✔ Behavioral biometrics → harder to spoof  
✔ Local-only processing → data is never uploaded  
✔ Perfect for resumes and cybersecurity portfolios  
✔ Real-world applicable threat prevention model  

---

## 🧾 Files YOU must add before pushing to GitHub
README.md (this file)
requirements.txt (the one listed here)
.gitignore (the one listed here)

These 3 are all you need to manually include.

---

## 📜 License
MIT License © 2025  
Author: **Piyush Nautiyal**

---

## ⭐ Support
If this project was helpful, please give it a ⭐ star on GitHub.

Shadow-Shield — Your identity is more than just a password.
