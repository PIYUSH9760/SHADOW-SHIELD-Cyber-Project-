const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("path");
let loginWindow;
let freezeWindow;
let attempts = 3;

function createFreezeScreen() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  freezeWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,

    webPreferences: {
      preload: path.join(__dirname, "freeze_preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  freezeWindow.loadFile("freeze.html");
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 450,
    height: 350,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const { workAreaSize } = screen.getPrimaryDisplay();
  loginWindow.setPosition(workAreaSize.width - 480, workAreaSize.height - 390);
  loginWindow.loadFile("frontend/index.html");
}

app.whenReady().then(() => {
  createLoginWindow();
});

// --- IPC: Login result handling (keeps your existing logic) ---
ipcMain.on("login-result", (event, status) => {
  if (status === "success") {
    if (freezeWindow) freezeWindow.close();
    loginWindow.close();
  } else if (status === "anomaly") {
    attempts--;
    // Send updated attempts count to renderer
    loginWindow.webContents.executeJavaScript(`
      attemptsRemaining = ${attempts};
      updateAttemptsDisplay();
    `);

    if (attempts <= 0) {
      createFreezeScreen();
      loginWindow.close();
    }
  } else {
    attempts--;
    // Send updated attempts count to renderer
    loginWindow.webContents.executeJavaScript(`
      attemptsRemaining = ${attempts};
      updateAttemptsDisplay();
    `);

    if (attempts <= 0) {
      createFreezeScreen();
      loginWindow.close();
    }
  }
});

ipcMain.on("shutdown-prototype", () => {
  if (freezeWindow) {
    freezeWindow.close();
    freezeWindow = null;
  }
});

ipcMain.on("unlock-system", () => {
  if (freezeWindow) {
    freezeWindow.close();
    freezeWindow = null;
  }
  attempts = 3;
  createLoginWindow();
});

// --------------------------
// IPC handlers for file dialogs (Option B)
// --------------------------
ipcMain.handle("open-file-dialog", async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: "Select a file to encrypt",
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0]; // return absolute path
});

ipcMain.handle("save-file-dialog", async (event, defaultName) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    title: "Save decrypted file as...",
    defaultPath: defaultName || "",
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

// add near other ipcMain handlers in main.js
const UNLOCK_PASSCODE = "9760";

ipcMain.on("unlock-attempt", (event, passcode) => {
  try {
    const win = freezeWindow; // the freeze window reference
    const ok = String(passcode || "") === UNLOCK_PASSCODE;

    if (ok) {
      // send success back to freeze renderer so it can show message
      if (win && win.webContents) win.webContents.send("unlock-result", { ok: true, msg: "Unlocked" });

      // close freeze and restore login
      if (freezeWindow) {
        freezeWindow.close();
        freezeWindow = null;
      }

      // reset attempts and open login window
      attempts = 3;
      if (!loginWindow || loginWindow.isDestroyed()) {
        createLoginWindow();
      } else {
        // if login window exists, bring to front
        loginWindow.show();
      }
    } else {
      if (win && win.webContents) win.webContents.send("unlock-result", { ok: false, msg: "Wrong passcode" });
    }
  } catch (err) {
    console.error("unlock-attempt handler error:", err);
    if (freezeWindow && freezeWindow.webContents) freezeWindow.webContents.send("unlock-result", { ok: false, msg: "Error" });
  }
});

