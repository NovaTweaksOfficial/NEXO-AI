import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsProvider } from './state/settings'
import { AuthProvider } from './state/auth'
import { ModerationProvider } from './state/moderation'
import { ChatProvider } from './state/chat'
import { UiProvider } from './state/ui'
import { ProgressProvider } from './state/progress'
import App from './App'
import './styles/app.css'
import 'highlight.js/styles/github-dark.css'

// The desktop app loads from file:// where service workers cannot work; the
// PWA's offline handler would otherwise replace the page with an error.
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* ignore */ })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <ModerationProvider>
          <ChatProvider>
            <UiProvider>
              <ProgressProvider>
                <App />
              </ProgressProvider>
            </UiProvider>
          </ChatProvider>
        </ModerationProvider>
      </AuthProvider>
    </SettingsProvider>
  </React.StrictMode>
)