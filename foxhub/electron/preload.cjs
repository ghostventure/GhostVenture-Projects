const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("foxhubDesktop", {
  platform: process.platform
});
