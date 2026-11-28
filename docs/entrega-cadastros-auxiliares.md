# Entrega: backend de cadastros auxiliares

Taynah, terminei a parte do backend para gerenciamento de instituições e colaboradores e deixei os arquivos nesta entrega para revisão e integração do grupo.

## O que foi concluído

- Instituições: criação, edição de nome, inativação, reativação e listagem administrativa de ativos/inativos, aproveitando a tabela e as migrações que você já havia criado.
- Colaboradores: proteção das operações administrativas para somente gestor e listagem administrativa completa, sem o limite de 20 resultados da busca operacional.
- Consultas usadas nas fichas continuam acessíveis aos dois perfis e retornam opções ativas.
- Verificação de nomes duplicados ignora acentos e maiúsculas/minúsculas e considera cadastros inativos. Corrigi também uma duplicidade de colaboradores que apareceu em solicitações simultâneas, usando transação serializável.
- Inativação preserva os IDs e os vínculos com transfusões existentes. Inativar colaborador não inativa uma eventual conta de acesso vinculada.
- Não alterei o frontend. A integração da tela fica com Thaís e Natália.
- Não criei novas migrações nesta entrega nem alterei as migrações já aplicadas.

## Atenção para integrar o frontend

As rotas POST/PATCH e as listagens `/gerenciamento` são exclusivas do gestor. O `GET /api/colaboradores` agora retorna somente ativos; para consultar todos, usar `GET /api/colaboradores/gerenciamento` com sessão de gestor.

O contrato completo, os exemplos de resposta e os erros esperados estão em [cadastros-auxiliares-api.md](cadastros-auxiliares-api.md).

## Validação realizada

- Build concluído sem erros.
- 82 testes unitários aprovados.
- 93 testes HTTP aprovados, incluindo 66 testes de permissões, sessão, CSRF e validação das rotas auxiliares.
- 15 testes com PostgreSQL aprovados, usando serviços reais e um schema isolado criado/removido pela suíte.
- Os testes PostgreSQL verificaram gravação, edição, duplicidade, concorrência, inativação/reativação, listagens e preservação dos vínculos de transfusão e usuário.
- Lint dos arquivos alterados aprovado.

## Arquivos de apoio disponíveis no repositório

- `docs/cadastros-auxiliares-api.md`: contrato para integrar as telas.
- `test/cadastros-auxiliares.e2e-spec.ts`: testes HTTP sem acesso ao banco.
- `test/cadastros-auxiliares.postgres-spec.ts` e `vitest.config.postgres.ts`: testes de persistência real em schema isolado.
- `npm run test:postgres`: comando de teste local; os pré-requisitos e limites estão explicados no contrato. Não executar contra produção.

Nenhum `.env`, senha, chave de API, backup ou configuração privada precisa ser enviado junto. Os arquivos necessários desta implementação estão no próprio repositório.

## Escopo restante

Esta entrega cobre a administração dos dois cadastros auxiliares. O comportamento de associação automática de instituição com município foi mantido; não foram implementados os outros pedidos do PDF de ajustes. Para a lista visual, a referência é exclusivamente a área destacada por Igor.
