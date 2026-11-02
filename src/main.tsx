import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Entrada } from './conta/Entrada'
import './index.css'
import { iniciarAtualizacoes } from './ui/Atualizacao'

// Pede ao navegador para não apagar os dados por falta de espaço ou de uso.
if (navigator.storage?.persist) void navigator.storage.persist()
iniciarAtualizacoes()
// Não roda dentro de moldura de outro site (evita cliques enganados, "clickjacking").
const emMoldura = (() => { try { return window.top !== window.self } catch { return true } })()
const raiz = document.getElementById('raiz')
if (emMoldura) { try { window.top!.location.href = window.location.href } catch { /* bloqueado: só não renderiza */ } }
else if (raiz) createRoot(raiz).render(<StrictMode><Entrada /></StrictMode>)
