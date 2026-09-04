import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { connect } from './backend'
import './styles.css'

// Probe the backend host and pull its snapshot BEFORE the first render, so the
// app opens with host state already in hand and no view needs a loading state.
// If the host is unreachable this resolves to offline mode against the bundled
// services — a supported way to run the product, not a failure — and the header
// says which mode the session is in.
await connect()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
