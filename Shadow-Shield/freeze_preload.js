// freeze_preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("freezeApi", {
  // send an unlock attempt (passcode string)
  attemptUnlock: (passcode) => ipcRenderer.send("unlock-attempt", passcode),

  // call the existing shutdown-prototype (backup exit)
  exitPrototype: () => ipcRenderer.send("shutdown-prototype"),

  // listen for unlock result (main will reply with true/false and optional message)
  onUnlockResult: (cb) => {
    ipcRenderer.on("unlock-result", (event, data) => {
      // data: { ok: boolean, msg: string }
      cb(data);
    });
  }
});
