# Deploy do backend do Hemocentro

Roteiro para instalar o sistema no servidor do hemocentro. A explicação completa (glossário, ciclo de status das fichas, perfis e todas as rotas da API) está em `docs/Documentação da API - Hemocentro.docx`.

> **Atenção antes do deploy: o frontend (projeto_hemocentro) ainda não usa este login. Ele não chama POST /api/auth/login, ainda manda o header antigo X-Usuario-Id e não envia cookie nem X-CSRF-Token. Com o backend atual, todas as telas, menos Esqueci a senha e Redefinir senha, vão receber 401. O frontend precisa ser ajustado (fetch com credentials: "include", guardar o csrfToken e mandar X-CSRF-Token, e VUE_APP_EXIGIR_LOGIN=true) antes de ir para produção.**

## Variáveis de ambiente

O backend lê o arquivo `.env` da pasta onde é iniciado (sem o arquivo, usa as variáveis do sistema). Comece copiando o modelo: `cp .env.example .env`. O `.env` tem senhas e chaves: não vai para o Git, e no servidor só o usuário do serviço deve ler (`chmod 600 .env`).

### Backend (backend/.env)

| Variável | Obrigatória | Padrão | Para que serve |
|---|---|---|---|
| `DATABASE_URL` | Sim | — | Conexão com o PostgreSQL: `postgresql://USUARIO:SENHA@HOST:5432/BANCO`. Caracteres especiais na senha precisam de URL-encode (`@` vira `%40`) |
| `PORT` | Não | `3000` | Porta HTTP do backend. Não está no `.env.example`; acrescente se precisar de outra |
| `NODE_ENV` | Recomendado | — | Use `production` no servidor. Assim, se faltar `SMTP_HOST`, o envio de e-mail dá erro em vez de imprimir o link no log |
| `GEMINI_API_KEY` | Pelo menos uma das 4 chaves de IA | — | Chave do Google Gemini (1ª tentativa) |
| `GEMINI_MODEL` | Não | `gemini-3.7-flash` | Modelo do Gemini. O `.env.example` sugere `gemini-3.8-flash` |
| `GROQ_API_KEY` | Opcional | — | Chave da Groq (2ª tentativa) |
| `GROQ_MODEL` | Não | `meta-llama/llama-4-scout-17b-16e-instruct` | Precisa ser um modelo com visão (até 5 páginas por ficha) |
| `OPENROUTER_API_KEY` | Opcional | — | Chave da OpenRouter, começa com `sk-or-v1-` (3ª tentativa) |
| `OPENROUTER_MODEL` | Não | `google/gemini-3.7-flash` | Formato `empresa/modelo`. O `.env.example` sugere `google/gemini-3.8-flash` |
| `OPENAI_API_KEY` | Opcional | — | Chave da OpenAI, começa com `sk-` (4ª tentativa) |
| `OPENAI_MODEL` | Não | `gpt-4.1` | Modelo da OpenAI (precisa ler imagens) |
| `CORS_ORIGINS` | Sim em produção | `http://localhost:8080,http://localhost:8081` | Endereço(s) do frontend, separados por vírgula, sem barra no fim. Vale para CORS, para a conferência do `Origin` no login e nas ações, e para o `<iframe>` que mostra o PDF |
| `FRONTEND_URL` | Sim em produção | `http://localhost:8080` | Endereço do frontend usado no link do e-mail: `FRONTEND_URL/redefinir-senha?token=...` |
| `FUSO_HORARIO` | Não | `America/Cuiaba` | Fuso (nome IANA) das datas nas respostas, mensagens, e-mails e planilhas |
| `TRUST_PROXY` | Sim atrás de proxy | vazio | Quantos proxies há na frente (ex.: `1` com um nginx) ou os IPs deles. Sem isso, o limite de tentativas de login enxerga todo mundo com o IP do proxy. Nunca use `true` |
| `SMTP_HOST` | Sim em produção | — | Servidor SMTP, ex.: `smtp.gmail.com` |
| `SMTP_PORT` | Não | `465` | `465` = SSL; `587` = STARTTLS |
| `SMTP_USUARIO` | Sim com SMTP | — | Usuário do SMTP (no Gmail, o endereço da conta) |
| `SMTP_SENHA` | Sim com SMTP | — | Senha do SMTP (no Gmail, a senha de app de 16 letras, sem espaços) |
| `SMTP_REMETENTE` | Não | `SMTP_USUARIO` | Remetente que aparece no e-mail, ex.: `Hemocentro <nao-responda@...>` |

### Frontend (projeto_hemocentro)

As variáveis do Vue entram no código na hora do build (`npm run build`): mudou, precisa gerar o build de novo. No servidor, crie `projeto_hemocentro/.env.production.local` (o Vue CLI lê esse arquivo no build de produção).

| Variável | Valor em produção | Para que serve |
|---|---|---|
| `VUE_APP_API_URL` | `https://hemocentro.exemplo.gov.br/api` | Endereço da API, com o prefixo `/api` |
| `VUE_APP_EXIGIR_LOGIN` | `true` | `true` = toda tela pede login. `false` só para desenvolvimento |

### Como obter as chaves das IAs

> As fichas têm dados de saúde (dado sensível pela LGPD). Antes de usar uma chave em produção, confira com o responsável pela proteção de dados do hemocentro os termos do provedor. Em geral, os planos gratuitos podem usar o conteúdo enviado para melhorar os modelos e os pagos não; prefira contas pagas e institucionais.

**Google Gemini** (`GEMINI_API_KEY`)

- Entre em `https://aistudio.google.com/apikey` com uma conta Google da instituição.
- Clique em **Create API key** (Criar chave de API), escolha ou crie um projeto do Google Cloud e copie a chave (começa com `AIza`).
- Para sair do limite gratuito, ative o faturamento do projeto no Google Cloud (Billing).

**Groq** (`GROQ_API_KEY`)

- Crie a conta em `https://console.groq.com` e abra **API Keys** (`https://console.groq.com/keys`).
- Clique em **Create API Key**, dê um nome (ex.: hemocentro) e copie a chave (começa com `gsk_`). Ela só aparece uma vez.

**OpenRouter** (`OPENROUTER_API_KEY`)

- Crie a conta em `https://openrouter.ai` e abra **Keys** (`https://openrouter.ai/settings/keys`).
- Clique em **Create Key** e copie a chave (começa com `sk-or-v1-`). Compre créditos em **Credits**: modelos pagos não funcionam sem saldo.

**OpenAI** (`OPENAI_API_KEY`)

- Entre em `https://platform.openai.com/api-keys` e clique em **Create new secret key**. Copie a chave (começa com `sk-`).
- Adicione créditos em **Settings → Billing**; sem saldo, toda chamada falha.

Basta uma chave para o sistema funcionar; as outras são reserva quando a primeira falha. Ao iniciar, o backend avisa no log quais IAs ficaram desativadas por falta de chave (`GROQ_API_KEY não definida — Groq desativado.`).

### Como configurar o e-mail (SMTP)

**Com Gmail (senha de app)**

- Use uma conta Gmail própria do sistema (ex.: hemocentro.sistema@gmail.com), não a pessoal de alguém.
- Ative a verificação em duas etapas: `https://myaccount.google.com/security` → **Verificação em duas etapas**. Sem ela, a opção de senha de app não aparece.
- Abra `https://myaccount.google.com/apppasswords`, digite um nome (ex.: Hemocentro backend) e clique em **Criar**. Copie a senha de 16 letras.
- No `.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USUARIO=` o endereço da conta, `SMTP_SENHA=` as 16 letras sem espaços, `SMTP_REMETENTE=Hemocentro <endereço da conta>` (o Gmail troca o remetente pelo endereço da conta).

**Com o e-mail da instituição**: peça à TI o servidor SMTP, a porta (465 ou 587), o usuário, a senha e um endereço remetente autorizado.

Para testar: na tela de login, use **Esqueci a senha** com o e-mail de um usuário ativo. Se o e-mail não chegar, o erro aparece no log do backend como `Falha no esqueci-senha: ...`.

## Deploy passo a passo

O roteiro abaixo usa um servidor Linux (Ubuntu Server 24.04) com nginx na frente, frontend e API no mesmo endereço (`https://hemocentro.exemplo.gov.br` para as telas e `https://hemocentro.exemplo.gov.br/api` para a API). Troque o domínio pelo real. Em Windows Server os passos são os mesmos; as diferenças estão nas notas. Cada bloco diz **onde** o comando deve ser rodado.

### O que o servidor precisa

- Node.js 24 LTS (o código usa `process.loadEnvFile`, que não existe antes do Node 20.12) e npm.
- PostgreSQL 16 ou mais novo, com os módulos contrib (trazem a extensão `unaccent`).
- nginx (ou IIS no Windows) com certificado HTTPS. HTTPS é obrigatório: o cookie de sessão é `Secure` e o navegador não o guarda em `http://` fora de localhost.
- Saída para a internet (HTTPS, porta 443) para os provedores de IA e para o SMTP (465 ou 587). A instalação do banco não precisa de internet: estados e municípios já estão na migração.
- Espaço em disco para `uploads/`: cada ficha escaneada tem de 4 a 18 MB.

### Passo 1 — Banco de dados

Onde: no servidor do banco, como administrador.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql
```

Dentro do `psql` (troque a senha):

```sql
CREATE ROLE hemocentro LOGIN PASSWORD 'troque-esta-senha';
CREATE DATABASE hemocentro OWNER hemocentro;
\c hemocentro
CREATE EXTENSION IF NOT EXISTS unaccent;
\q
```

A migração `20261031230000_unaccent` também cria a extensão, mas criar aqui como `postgres` evita erro de permissão. Windows: o instalador do PostgreSQL (EDB) já traz os contrib; rode os mesmos comandos no SQL Shell (psql).

### Passo 2 — Código do backend

Onde: no servidor da aplicação.

```bash
sudo mkdir -p /opt/hemocentro && sudo chown $USER /opt/hemocentro
cd /opt/hemocentro
git clone https://github.com/Taynah-M-Alves/Backend-Hemocentro.git backend
```

Se copiar a pasta em vez de clonar, não leve `node_modules/`, `dist/`, `uploads/` nem `.env` do computador de desenvolvimento.

### Passo 3 — Arquivo .env

Onde: `/opt/hemocentro/backend`.

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Preencha conforme a seção Variáveis de ambiente. Mínimo para produção:

```bash
DATABASE_URL=postgresql://hemocentro:troque-esta-senha@localhost:5432/hemocentro
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=...
CORS_ORIGINS=https://hemocentro.exemplo.gov.br
FRONTEND_URL=https://hemocentro.exemplo.gov.br
FUSO_HORARIO=America/Cuiaba
TRUST_PROXY=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USUARIO=...
SMTP_SENHA=...
SMTP_REMETENTE=Hemocentro <...>
```

### Passo 4 — Dependências

Onde: `/opt/hemocentro/backend`.

```bash
npm ci
```

`npm ci` instala exatamente as versões do `package-lock.json`. Rode no próprio servidor: `argon2` e `@napi-rs/canvas` baixam binários do sistema operacional, então `node_modules` copiado de outra máquina (principalmente de Windows para Linux) não funciona.

### Passo 5 — Cliente do Prisma

Onde: `/opt/hemocentro/backend`.

```bash
npx prisma generate
```

Gera o código de acesso ao banco em `src/generated/prisma`. Precisa vir antes do build.

### Passo 6 — Estrutura do banco (migrações)

Onde: `/opt/hemocentro/backend` (o Prisma lê o `DATABASE_URL` do `.env`).

```bash
npx prisma migrate deploy
npx prisma migrate status
```

Aplica, em ordem, as migrações de `prisma/migrations`: tabelas, enums, extensão `unaccent` e a carga de estados e municípios do IBGE (`20261105010000_localidades_ibge`, 27 UFs e 5.571 municípios). O `migrate status` deve responder que o banco está atualizado.

> Não use npx prisma db push nem npx prisma migrate dev no servidor. O db push ignora as migrações: o banco fica sem estados e municípios e sem o histórico de migrações, e a próxima atualização falha. O migrate dev é só para desenvolvimento e pode apagar dados.

**Migração do IBGE**: ela já vem pronta no repositório e não precisa de internet no servidor. Só gere de novo se a pasta `prisma/migrations/20261105010000_localidades_ibge` estiver faltando, e sempre antes do primeiro `migrate deploy`, num computador com internet:

```bash
node scripts/gerar-localidades-ibge.mjs
```

O script busca a lista na API do IBGE (`servicodados.ibge.gov.br`) e regrava o `migration.sql`. Depois que a migração foi aplicada num banco, não gere nem edite de novo: o Prisma compara o conteúdo e acusa a diferença.

### Passo 7 — Build do backend

Onde: `/opt/hemocentro/backend`.

```bash
npm run build
```

Gera a pasta `dist/` (o servidor roda `dist/main.js`).

### Passo 8 — Primeiro gestor

Onde: `/opt/hemocentro/backend` (o script lê o `.env` da pasta atual). Uma vez só.

```bash
node dist/scripts/criar-primeiro-gestor.js
```

Pergunta nome, e-mail e senha (a digitação fica oculta) e cria o usuário com perfil `GESTOR`. Se já existir um gestor, recusa e não altera nada. Os demais usuários são criados pelo gestor, no sistema (veja Primeiro gestor e primeiro acesso).

### Passo 9 — Backend como serviço

Onde: no servidor, como administrador. Crie `/etc/systemd/system/hemocentro-backend.service`:

```ini
[Unit]
Description=Hemocentro backend
After=network.target postgresql.service

[Service]
User=hemocentro
WorkingDirectory=/opt/hemocentro/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/main.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd --system --home /opt/hemocentro hemocentro
sudo chown -R hemocentro /opt/hemocentro/backend
sudo systemctl daemon-reload
sudo systemctl enable --now hemocentro-backend
journalctl -u hemocentro-backend -f
```

O `WorkingDirectory` importa: o `.env` e a pasta `uploads/` são lidos a partir dele. No log deve aparecer `Servidor rodando em http://localhost:3000/api`. Rode uma instância só: o limite de tentativas de login fica na memória do processo. Windows: rode `node dist/main.js` como serviço com NSSM (`nssm install hemocentro-backend`), apontando o diretório de início para a pasta do backend.

### Passo 10 — Build do frontend

Onde: no servidor (ou numa máquina de build), na pasta do frontend.

```bash
cd /opt/hemocentro
git clone https://github.com/ThaisVDR/projeto_hemocentro.git
cd projeto_hemocentro
printf 'VUE_APP_API_URL=https://hemocentro.exemplo.gov.br/api\nVUE_APP_EXIGIR_LOGIN=true\n' > .env.production.local
npm ci
npm run build
sudo mkdir -p /var/www/hemocentro
sudo cp -r dist/* /var/www/hemocentro/
```

Lembre do aviso em Login e perfis: o frontend precisa do ajuste de login antes deste passo.

### Passo 11 — Proxy reverso (nginx) com HTTPS

Onde: no servidor, como administrador. Crie `/etc/nginx/sites-available/hemocentro`:

```nginx
server {
    listen 443 ssl;
    server_name hemocentro.exemplo.gov.br;
    ssl_certificate     /etc/ssl/certs/hemocentro.crt;
    ssl_certificate_key /etc/ssl/private/hemocentro.key;

    # Frontend (Vue com history mode: toda rota cai no index.html)
    root /var/www/hemocentro;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 1600m;   # até 30 arquivos de 50 MB
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

server {
    listen 80;
    server_name hemocentro.exemplo.gov.br;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hemocentro /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Com um nginx na frente, `TRUST_PROXY=1` no `.env`. Sem certificado da instituição, um gratuito sai com `sudo certbot --nginx -d hemocentro.exemplo.gov.br` (o domínio precisa ser público). Deixe a porta 3000 fechada para fora do servidor: só o nginx fala com o backend. No IIS, o equivalente é URL Rewrite + Application Request Routing, com o mesmo limite de upload (`maxAllowedContentLength`).

### Passo 12 — Conferência

- `curl -i https://hemocentro.exemplo.gov.br/api/auth/sessao` responde 401 em JSON: o backend está no ar atrás do proxy.
- Abra o site, entre com o gestor e confira que a sessão continua ao recarregar a página (cookie aceito).
- Use Esqueci a senha com um usuário de teste e confira se o e-mail chega com o link apontando para o site.
- Envie uma ficha de teste e acompanhe no log: `Ficha N lida (gemini).` A ficha deve aparecer em Aguardando revisão.

### Backup

Copie juntos, todo dia, o banco e a pasta de arquivos (um sem o outro não basta: o banco aponta para os arquivos de `uploads/`):

```bash
pg_dump -Fc -U hemocentro hemocentro > /backup/hemocentro-$(date +%F).dump
tar czf /backup/uploads-$(date +%F).tar.gz -C /opt/hemocentro/backend uploads
```

### Atualizar uma versão já instalada

Onde: `/opt/hemocentro/backend`.

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
sudo systemctl restart hemocentro-backend
```

No frontend: `git pull`, `npm ci`, `npm run build` e copiar `dist/` de novo para `/var/www/hemocentro`.

### Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Aprovar ficha dá erro `function unaccent(text) does not exist` (42883) | O banco foi montado com `db push` ou sem os contrib. Instale `postgresql-contrib` e rode `CREATE EXTENSION unaccent;` no banco |
| `migrate deploy` responde P3005 (banco não está vazio) | O banco foi criado com `db push`. Em instalação nova, recrie o banco vazio (passo 1) e rode o `migrate deploy` |
| Lista de cidades vazia na revisão | A migração do IBGE não foi aplicada. Confira `npx prisma migrate status` |
| Login funciona, mas a próxima tela dá 401 | O cookie não foi guardado: site sem HTTPS, ou frontend e API em domínios diferentes. Sirva os dois no mesmo domínio, com HTTPS |
| 403 "Origem não permitida." | O endereço do site não está em `CORS_ORIGINS` (confira https, www e porta, sem barra no fim) |
| 403 "Token de proteção inválido." | O frontend não mandou `X-CSRF-Token` (veja o aviso sobre o login do frontend) |
| Todas as fichas vão para `FALHA_LEITURA` | Sem chave de IA, sem saldo ou sem saída para a internet. O motivo aparece no log e no evento `LEITURA_FALHOU` da auditoria |
| Upload grande responde 413 | `client_max_body_size` do nginx menor que o envio |
| Uma pessoa bloqueia o login de todos (429) | `TRUST_PROXY` vazio atrás do proxy: todo mundo parece ter o mesmo IP |
| E-mail não chega | Confira `SMTP_*` e o log (`Falha no esqueci-senha`). No Gmail, a senha comum não funciona: precisa da senha de app |

