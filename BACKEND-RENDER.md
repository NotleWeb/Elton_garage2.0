# Deploy do Backend no Render

Este projeto usa um backend Node em `artifacts/api-server` e deve ser hospedado em um serviço que execute Node (como Render).

## Por que Render
Render suporta aplicativos Node persistentes e o projeto já tem um arquivo `render.yaml` preparado. O backend precisa rodar como servidor contínuo e não como site estático.

## O que o backend exige

Variáveis de ambiente necessárias:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
  - o JSON completo da conta de serviço Firebase
  - deve ser copiado como texto no painel de variáveis do Render
- `SESSION_SECRET`
  - string aleatória para assinar tokens/sessões
- `NODE_ENV`
  - `production` (recomendado)

## Como conectar o repo no Render

1. Entre em render.com e crie uma conta ou faça login.
2. Clique em **New** > **Web Service**.
3. Conecte seu repositório Git onde está o projeto.
4. Escolha o branch correto.
5. Defina as configurações de serviço ou use o `render.yaml` do repo.

## Configuração usada pelo projeto

O `render.yaml` já define:

- `type: web`
- `name: elton-garage-api`
- `runtime: node`
- `region: oregon`
- `plan: free`
- `buildCommand: pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- `startCommand: pnpm --filter @workspace/api-server run start`
- `healthCheckPath: /api/healthz`

Se o Render não usar automaticamente o `render.yaml`, copie essas configurações manualmente.

> Importante: se o Render mostrar o comando `pnpm run build` nos logs, altere manualmente para o comando acima no painel do serviço.

## Se o build falhar no Render

- Verifique se o `package.json` root e o `pnpm-workspace.yaml` estão no diretório raiz do repo.
- Render deve instalar dependências com `pnpm install`.
- O comando de build no `render.yaml` já foca no pacote `@workspace/api-server`.

## Testando localmente antes de deploy

1. Crie um arquivo `.env.local` ou use variáveis de ambiente no terminal:
   - `PORT=3001`
   - `FIREBASE_SERVICE_ACCOUNT_JSON={...json...}`
   - `SESSION_SECRET=algumsegredoforte`

2. Execute:
   ```powershell
   cd artifacts/api-server
   pnpm run start
   ```

3. Verifique se a API responde:
   - `http://localhost:3001/api/healthz`

## Como usar depois de deploy

- No frontend Netlify, defina `VITE_API_URL` para a URL pública do backend Render.
- Exemplo: `https://elton-garage-api.onrender.com`
- O frontend então chamará a API usando essa URL.

## Observações importantes

- O backend deve ser deployado separadamente do frontend.
- O Firestore só salva dados se `FIREBASE_SERVICE_ACCOUNT_JSON` estiver correto.
- O `render.yaml` foi atualizado para usar `FIREBASE_SERVICE_ACCOUNT_JSON` em vez de `DATABASE_URL`.
