const { contextBridge } = require('electron')
const { electronAPI } = require('@electron-toolkit/preload')

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
} catch (error) {
  console.error(error)
}
