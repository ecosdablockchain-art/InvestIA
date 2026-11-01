# Finanças 360

Finanças pessoais num site que funciona em qualquer aparelho (iPhone, Android, computador) e pode ser instalado na tela inicial (PWA). Cada pessoa tem a sua conta (e-mail e senha); os dados ficam na nuvem (Supabase), protegidos por regras que impedem um usuário de ver os dados de outro, com cópia no aparelho para funcionar offline.

Configuração do servidor: veja `supabase/CONFIGURAR.md`.

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
- Sincronização: cada registro vai para a tabela `registros` do Supabase como JSON; vence a alteração mais recente. Testes do SQL: `supabase/teste-local.sql` (Postgres local simulando o Supabase).

## Privacidade e limites

- O bloqueio com Face ID impede que alguém com o seu celular desbloqueado abra o app. Ele **não criptografa** os dados do navegador.
- Sem backup, apagar os dados do Safari apaga tudo. Use **Ajustes › Exportar backup** de vez em quando.

## Fases

1. ✅ Estrutura, banco local, abas, Face ID, Ajustes, tema
2. ✅ Lançamentos, orçamento do mês, limites, recorrentes
3. ✅ Painel completo, histórico e previsão de 6 meses
4–5. Importação de extratos (OFX, CSV, PDF, OCR): removida a pedido; o código está no histórico do git (commit 9bcdcf2)
6. ✅ Cartões, faturas, parcelados, dívidas e simulador
7. ✅ Investimentos, cotações, reserva, metas, patrimônio
8. Casa compartilhada: fora do plano
9. Notificações
10. Consultor com IA e camada de jogo
