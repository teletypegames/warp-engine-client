import { app, ipcMain, shell } from 'electron'
import { ElectronApplication } from './ElectronApplication'

// The entry point does one thing: everything else is a class with a name.
new ElectronApplication(app, ipcMain, shell).start()
