// Finanças 360 — recebe notificações (Web Push) e abre o app na tela certa ao tocar.
self.addEventListener('push', (evento) => {
  let dados = {}
  try { dados = evento.data ? evento.data.json() : {} } catch { dados = { corpo: evento.data ? evento.data.text() : '' } }
  const titulo = dados.titulo || 'Finanças 360'
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.corpo || '',
    tag: dados.tag || undefined,
    icon: 'icone-192.png',
    badge: 'icone-192.png',
    data: { url: dados.url || '#/painel' },
  }))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(self.registration.scope).href + (evento.notification.data && evento.notification.data.url ? evento.notification.data.url : '#/painel')
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const j of janelas) {
      if (j.url.startsWith(self.registration.scope)) { await j.focus(); return j.navigate(destino) }
    }
    return self.clients.openWindow(destino)
  })())
})
