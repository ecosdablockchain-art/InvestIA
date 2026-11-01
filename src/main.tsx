import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { db } from './db/banco'
import { garantirDadosIniciais } from './db/padroes'
import './index.css'

async function iniciar() {
  await garantirDadosIniciais(db)
  // Pede ao navegador para não apagar os dados por falta de espaço ou de uso.
  if (navigator.storage?.persist) void navigator.storage.persist()
  const raiz = document.getElementById('raiz')
  if (!raiz) return
  createRoot(raiz).render(<StrictMode><App /></StrictMode>)
}

void iniciar()
