import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/instrument-sans' // bundled + precached → works offline
import { applyTheme, getTheme } from './lib/theme.js'
import App from './App.jsx'
import './styles.css'

applyTheme(getTheme()) // before first paint, so there's no light-then-dark flash

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
