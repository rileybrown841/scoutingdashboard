import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './Datacontext'
import './global.css'
import Landing from './landing'
import Config from './config'
import Dashboard from './dashboard'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/config" element={<Config />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </DataProvider>
    </BrowserRouter>
  </StrictMode>
)