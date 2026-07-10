# Elton_garage2.0

Sistema de gestão para a Estética automotiva Elton Garage.

Gerenciamente de Agendamentos
Clientes
Serviços
Estoque
Financeiro

## Deploy para Web

### Frontend (Netlify)

1. Aponte o site para o diretório `artifacts/elton-garage/dist/public`.
2. Configure o comando de build:
   - `pnpm --filter @workspace/elton-garage run build`
3. Adicione um redirect:
   - `/* /index.html 200`
4. Defina a variável de ambiente:
   - `VITE_API_URL=https://<sua-api>`

### Backend (Render ou serviço Node similar)

1. Publique o serviço baseado em `render.yaml`.
2. O backend usa `artifacts/api-server` e precisa de:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `SESSION_SECRET`
   - `NODE_ENV=production`
3. No painel do Render, configure `FIREBASE_SERVICE_ACCOUNT_JSON` como segredo com o JSON da conta de serviço do Firebase.

### Banco de dados

- O backend grava os dados no Firebase Firestore.
- Os dados ficam persistidos em nuvem se o backend estiver rodando com o `FIREBASE_SERVICE_ACCOUNT_JSON` correto.

### Observações

- A parte estática do app pode ficar em Netlify.
- O backend deve rodar separadamente em um host Node.
- O frontend usa `VITE_API_URL` para se conectar à API em produção.
