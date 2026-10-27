# Roteiro de apresentação — Segurança e autenticação

**Duração sugerida:** 4 a 5 minutos  
**Tema:** login, perfis, tokens/sessões e tratamento de exceções

## Slide 1 — Objetivo

**Fala**

“Nesta parte vou apresentar como o Elton Garage protege o acesso à API. O fluxo começa pela identificação do usuário no login, continua com a validação de um token nas operações protegidas e trata erros com respostas apropriadas para cada situação.”

**Transição**

“Vou começar pelo processo de login e pela forma como as credenciais são verificadas.”

## Slide 2 — Login e credenciais

**Fala**

“O usuário envia e-mail e senha para o endpoint de autenticação. O backend valida se os campos foram informados, normaliza o e-mail e verifica se a conta está ativa. A senha não é comparada em texto puro: o sistema usa bcrypt para conferir a senha com o hash armazenado. Se os dados não forem válidos, a API responde com erro de autenticação sem revelar se o problema foi o e-mail ou a senha.”

“Quando o login é válido, a API gera um JWT assinado com o segredo configurado no ambiente. A resposta identifica o usuário e informa seu perfil, sem devolver o hash da senha.”

**Transição**

“Com o login concluído, o token acompanha as próximas chamadas à API.”

## Slide 3 — Tokens, sessão e perfis

**Fala**

“O token tem validade de sete dias. Ele é enviado na resposta do login e também é gravado em um cookie HttpOnly, com SameSite Strict e, em produção, a opção Secure. O cookie ajuda a reduzir a exposição do token a scripts no navegador. O logout limpa esse cookie.”

“Nas rotas protegidas, o middleware valida o JWT e disponibiliza o identificador e o perfil do usuário para a requisição. O endpoint de consulta do usuário atual também aceita o token pelo cabeçalho Authorization ou pelo cookie.”

“O perfil, ou role, acompanha a identidade no token e fica disponível para a aplicação. É importante distinguir isso de uma matriz completa de permissões: no código verificado, não encontrei regras que restrinjam ações diferentes por perfil. Portanto, apresento aqui a identificação do perfil, não uma autorização granular já comprovada.”

**Transição**

“Além de validar quem acessa, a API precisa responder de maneira previsível quando algo dá errado.”

## Slide 4 — Tratamento de exceções e proteção da API

**Fala**

“Os erros são classificados conforme o problema. Dados obrigatórios ausentes ou inválidos retornam HTTP 400. Credenciais inválidas, usuário inativo ou token ausente, inválido ou expirado retornam HTTP 401. Um recurso inexistente pode retornar HTTP 404, e conflitos de agenda retornam HTTP 409.”

“Para falhas inesperadas, há um tratamento final que registra o erro no log e responde com HTTP 500, sem expor detalhes internos ao cliente. A API também limita tentativas de autenticação, força HTTPS em produção e usa cabeçalhos de segurança com Helmet.”

**Transição**

“Agora vou demonstrar rapidamente os principais cenários.”

## Slide 5 — Demonstração e resultados

**Fala e demonstração**

1. “Primeiro, faço login com uma conta ativa e observo o usuário e o perfil retornados. Não vou projetar nem ler o token.”
2. “Em seguida, consulto uma rota protegida sem token: a API recusa o acesso com HTTP 401.”
3. “Repito a chamada autenticada com o token recebido: o middleware valida a assinatura e libera a requisição.”
4. “Por fim, envio credenciais inválidas para mostrar que a API retorna uma resposta genérica de autenticação, sem indicar qual campo falhou.”
5. “Também posso mostrar que o logout remove o cookie de autenticação.”

**Encerramento**

“Como resultado, temos autenticação por senha com bcrypt, tokens JWT com expiração, suporte a cookie protegido, middleware para validar chamadas e respostas de erro padronizadas. O perfil do usuário já é transportado e disponibilizado; como próximo passo de segurança, falta formalizar e aplicar políticas de autorização por perfil nas rotas que exigem permissões diferentes.”

## Notas para a apresentação

- Use uma conta de demonstração autorizada. Nunca mostre senhas reais, tokens completos ou valores de `SESSION_SECRET`.
- Para demonstrar a autenticação, prefira mostrar o status HTTP e campos não sensíveis da resposta.
- O código do login devolve o JWT no corpo da resposta e também define o cookie HttpOnly; não descreva a implementação como exclusivamente baseada em cookie.
- Não afirme que admin, staff e customer têm permissões distintas já aplicadas às rotas sem antes implementar e testar essas regras.

## Como executar a demonstração no Postman

1. Importe `POSTMAN_SEGURANCA.collection.json` no Postman.
2. Abra o pedido `Executar roteiro completo de autenticacao` e clique em **Send** uma vez. A URL já aponta para `http://localhost:3001`.
3. O script do Postman testa saúde da API, login válido, identidade autenticada, rota protegida sem token, senha inválida e logout. O JWT fica apenas em memória durante a consulta de identidade e é descartado ao final.
4. A conta `admin@eltongarage.com` / `admin123` é criada no Firestore Emulator local para esta demonstração. Use-a somente com a coleção local; não altere a URL para produção.
5. Para registrar evidências, capture os nomes dos pedidos, status HTTP e perfil retornado. Oculte o corpo do login, pois ele contém o token, e não exiba cookies ou cabeçalhos de autorização.
