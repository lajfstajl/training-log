import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { db } from './db/schema'
import { seedIfNeeded } from './db/seed'
import './index.css'

registerSW({ immediate: true })

async function boot() {
  await seedIfNeeded(db)
  // Ask the browser not to evict our data. Home screen PWAs on iOS are exempt from the 7 day rule anyway.
  if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
    await navigator.storage.persist().catch(() => false)
  }
}

boot().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
