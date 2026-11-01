import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Entrada } from './conta/Entrada'
import './index.css'
import { iniciarAtualizacoes } from './ui/Atualizacao'

// Pede ao navegador para não apagar os dados por falta de espaço ou de uso.
if (navigator.storage?.persist) void navigator.storage.persist()
iniciarAtualizacoes()
const raiz = document.getElementById('raiz')
if (raiz) createRoot(raiz).render(<StrictMode><Entrada /></StrictMode>)
