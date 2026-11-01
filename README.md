# Finanças 360

Finanças pessoais num site que se instala no iPhone (PWA). É privado (os dados ficam só no aparelho), funciona offline e tem bloqueio com Face ID.

## Rodar no computador

Precisa do Node.js 20 ou superior.

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes dos cálculos e do banco
npm run build      # gera a versão final em dist/
```

## Instalar no iPhone

1. Abra o endereço publicado no **Safari**. O Face ID só funciona em endereço com https.
2. Toque em **Compartilhar** › **Adicionar à Tela de Início**.
3. Use sempre pelo ícone: assim o iPhone mantém os dados e o app funciona sem internet.

## Organização

```
src/
  core/        cálculos puros, com testes (dinheiro em centavos, datas no fuso de SP, orçamento)
  db/          banco local (IndexedDB via Dexie), tipos dos modelos, backup
  seguranca/   bloqueio com Face ID (passkey), preferências
  ui/          componentes visuais e barra de abas
  telas/       Painel, Ajustes e as demais abas
```

## Regras do projeto

- Dinheiro sempre em **centavos inteiros**, nunca número quebrado.
- Datas como `AAAA-MM-DD` no fuso America/Sao_Paulo. Mês de competência como `AAAAMM`.
- Nada de número de cartão, CVV ou senha de banco. Arquivos importados são lidos em memória e descartados.
- Chaves de API são digitadas nos Ajustes e ficam só no aparelho.

## Privacidade e limites

- O bloqueio com Face ID impede que alguém com o seu celular desbloqueado abra o app. Ele **não criptografa** os dados do navegador.
- Sem backup, apagar os dados do Safari apaga tudo. Use **Ajustes › Exportar backup** de vez em quando.

## Fases

1. ✅ Estrutura, banco local, abas, Face ID, Ajustes, tema
2. ✅ Lançamentos, orçamento do mês, limites, recorrentes
3. Painel completo, histórico e previsão de 6 meses
4. Importação OFX/CSV + conferência + regras + desfazer
5. Importação PDF e foto (OCR)
6. Cartões, faturas, parcelados, dívidas e simulador
7. Investimentos, cotações, reserva, metas, patrimônio
8. Casa compartilhada
9. Notificações
10. Consultor com IA e camada de jogo
