const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

const isMac = process.platform === 'darwin'

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: 'NEXUS AI',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#080810',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // The web app is bundled inside the native app, so it works offline.
  win.loadFile(path.join(__dirname, 'app', 'index.html'))

  // Open outside links in the user's real browser, not inside NEXUS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'NEXUS',
      submenu: [
        { label: 'About NEXUS AI', click: () => shell.openExternal('https://novatweaksofficial.github.io/NEXUS-AI/') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
