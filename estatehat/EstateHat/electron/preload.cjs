const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("estatehatDesktop", {
  platform: "windows-desktop",
});
