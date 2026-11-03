# Backup do banco (Supabase → GitHub)

O plano gratuito do Supabase não faz backup. Uma rotina no GitHub (`.github/workflows/backup.yml`)
exporta os dados toda segunda-feira, **criptografa com a sua senha** e guarda o arquivo por 90 dias
na aba **Actions** do repositório. Sem a senha, o arquivo é ilegível, mesmo com o repositório público.

O que entra: todas as tabelas do app (`public.*`) e as contas de login (`auth.users`, `auth.identities`).

## Configurar (uma vez, ~10 minutos)

### 1. Endereço de conexão do banco
1. No Supabase, clique em **Connect** (topo da página do projeto).
2. Em **Connection string**, escolha **URI** e o método **Session pooler** (funciona a partir do GitHub; o "Direct connection" não).
3. Copie o endereço. Ele tem a forma
   `postgresql://postgres.ppuxdtzpjuxprriyeaar:[YOUR-PASSWORD]@aws-0-….pooler.supabase.com:5432/postgres`
4. Troque `[YOUR-PASSWORD]` pela senha do banco (a que você criou junto com o projeto).
   Esqueceu? **Project Settings › Database › Reset database password** (o app não usa essa senha, pode trocar).
   Se a senha tiver caracteres especiais (`@ # / ? %`), prefira gerar uma só com letras e números.

### 2. Senha do backup
Crie uma senha forte só para os backups (pelo menos 16 caracteres) e **guarde num gerenciador de senhas**.
Sem ela, nenhum backup pode ser aberto, nem por você.

### 3. Cadastrar os dois segredos no GitHub
No repositório **InvestIA › Settings › Secrets and variables › Actions › New repository secret**:

| Name | Secret |
|---|---|
| `SUPABASE_DB_URL` | o endereço do passo 1, já com a senha do banco |
| `BACKUP_SENHA` | a senha do passo 2 |

Os segredos ficam guardados pelo GitHub: ninguém (nem quem vê o repositório) consegue lê-los depois.

### 4. Testar
**Actions › Backup do banco › Run workflow**. Em 1 ou 2 minutos deve ficar verde, e no fim da página
aparece o arquivo **backup-AAAA-MM-DD**.

## Restaurar (emergência)

Precisa de um computador com `psql` e `gpg`, ou peça ao Claude numa sessão (mande o arquivo e diga a senha
do backup só no momento da restauração).

1. Crie um projeto novo no Supabase (ou use o atual, se ele estiver vazio).
2. No SQL Editor, rode na ordem: `migracao.sql`, `migracao-notificacoes.sql`, `seguranca.sql`.
3. Rode `delete from public.config_push;` (a instalação cria uma linha que o backup vai repor).
4. Baixe o arquivo em **Actions › (execução) › Artifacts** e descompacte o `.zip`.
5. Restaure:
   ```
   gpg -d backup-AAAA-MM-DD.sql.gz.gpg | gunzip | psql "ENDEREÇO-DO-BANCO-NOVO"
   ```
6. Se o projeto for novo, atualize `src/nuvem/projeto.ts` (endereço e chave pública) e refaça
   o serviço `notificar` e o agendador (NOTIFICACOES.md).

## Bom saber
- O GitHub desliga rotinas agendadas de repositórios sem nenhuma alteração por 60 dias. Se isso acontecer,
  ele avisa por e-mail; basta clicar em **Enable workflow** em Actions.
- Cada backup fica 90 dias; sempre há cerca de 12 cópias semanais disponíveis.
