import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Entrada } from './conta/Entrada'
import './index.css'

// Pede ao navegador para não apagar os dados por falta de espaço ou de uso.
if (navigator.storage?.persist) void navigator.storage.persist()
const raiz = document.getElementById('raiz')
if (raiz) createRoot(raiz).render(<StrictMode><Entrada /></StrictMode>)
