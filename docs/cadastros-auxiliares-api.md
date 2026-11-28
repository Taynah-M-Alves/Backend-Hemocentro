# Cadastros auxiliares: contrato do backend

Implementação local de instituições e colaboradores, com administração exclusiva do perfil `GESTOR`. Documento para integração do frontend por Thaís e Natália. As alterações ainda precisam ser revisadas e publicadas pelo grupo.

## Autenticação e proteção

- Prefixo da API: `/api`.
- Enviar o cookie de sessão existente (`credentials: 'include'` no fetch).
- Em POST e PATCH, enviar `X-CSRF-Token` da sessão e `Content-Type: application/json` quando houver JSON.
- A sessão precisa estar válida, com usuário ativo e sem troca obrigatória de senha pendente.
- Consultas operacionais de opções ativas: `GESTOR` ou `COLABORADOR`.
- Listagem administrativa, criação, edição, inativação e reativação: apenas `GESTOR`.
- O menu e a rota da futura tela devem respeitar essa regra; o backend também a verifica.

## Rotas

| Método | Endereço                           | Acesso          | Resultado                                         |
| ------ | ---------------------------------- | --------------- | ------------------------------------------------- |
| GET    | `/api/instituicoes`                | Ambos os perfis | Instituições ativas, ordenadas pelo nome          |
| GET    | `/api/instituicoes/gerenciamento`  | Gestor          | Todas as instituições, ativas e inativas          |
| POST   | `/api/instituicoes`                | Gestor          | Cadastra uma instituição; HTTP 201                |
| PATCH  | `/api/instituicoes/:id`            | Gestor          | Altera o nome; HTTP 200                           |
| POST   | `/api/instituicoes/:id/inativar`   | Gestor          | Define `ativo: false`; HTTP 200                   |
| POST   | `/api/instituicoes/:id/reativar`   | Gestor          | Define `ativo: true`; HTTP 200                    |
| GET    | `/api/colaboradores?busca=mar`     | Ambos os perfis | Somente ativos; busca opcional; até 20 resultados |
| GET    | `/api/colaboradores/gerenciamento` | Gestor          | Todos os colaboradores, sem o limite de 20        |
| POST   | `/api/colaboradores`               | Gestor          | Cadastra um profissional; HTTP 201                |
| PATCH  | `/api/colaboradores/:id`           | Gestor          | Altera o nome; HTTP 200                           |
| POST   | `/api/colaboradores/:id/inativar`  | Gestor          | Define `ativo: false`; HTTP 200                   |
| POST   | `/api/colaboradores/:id/reativar`  | Gestor          | Define `ativo: true`; HTTP 200                    |

As rotas de gerenciamento não recebem filtros de busca ou situação neste momento; a interface pode filtrar a lista retornada. `GET /colaboradores` retorna somente ativos independentemente de um antigo parâmetro `ativo`; para consultar inativos, usar a rota de gerenciamento com sessão de gestor.

## Corpos e respostas

POST de criação e PATCH de nome recebem:

```json
{ "nome": "Hospital de Teste" }
```

O nome é obrigatório, precisa ser texto não vazio e possui limite de 255 caracteres. Instituições preservam a capitalização/siglas e normalizam espaços consecutivos; campos diferentes de `nome` são recusados. Colaboradores usam a normalização de nomes próprios já existente (por exemplo, `MARIA DA SILVA` vira `Maria da Silva`). O DTO atual de colaboradores ignora campos adicionais; eles não são persistidos. Não enviar `ativo` no PATCH: usar as operações específicas de situação.

Resposta de criação/edição/situação de instituição ou colaborador:

```json
{ "id": 123, "nome": "Hospital de Teste", "ativo": true }
```

`POST /:id/inativar` e `POST /:id/reativar` não precisam de corpo. Repetir uma dessas operações mantém a situação solicitada, sem criar outro registro.

Listagem operacional de instituições:

```json
[{ "id": 123, "nome": "Hospital de Teste" }]
```

Listagem administrativa de instituições inclui também `ativo`. As duas listagens de colaboradores retornam:

```json
[
  {
    "id": 456,
    "nome": "Profissional de Teste",
    "ativo": true,
    "usuarioId": null
  }
]
```

`usuarioId` identifica uma conta de acesso vinculada, quando existir. Cadastrar um colaborador não cria usuário, senha ou sessão.

## Regras de nomes, situação e histórico

- Criação e edição recusam outro cadastro com nome igual, ignorando maiúsculas/minúsculas e acentos; a comparação SQL também remove espaços nas extremidades.
- A regra considera tanto registros ativos quanto inativos. Se o nome já existir inativo, a interface deve oferecer reativação em vez de cadastrar novamente.
- A edição desconsidera o próprio ID na verificação de duplicidade.
- Verificação de nome e gravação ocorrem na mesma transação serializável. Em conflito de concorrência, a API retorna HTTP 409 e a interface pode orientar atualização/tentativa novamente.
- Essa proteção cobre as gravações pelos serviços. Não há novo índice único normalizado no banco; inserções SQL externas podem contornar essa regra.
- Inativação não exclui o registro e não remove referências nas transfusões/pesquisas existentes. A reativação reutiliza o mesmo ID.
- Editar o nome altera o cadastro referenciado. Esta implementação não cria uma versão histórica independente do nome anterior.
- Inativar colaborador não inativa sua eventual conta de usuário. São cadastros distintos; contas continuam sendo administradas em `/api/usuarios`.
- Seleções operacionais deixam de oferecer inativos. O código preexistente de persistência/revisão de fichas ainda resolve nomes inclusive inativos para referências históricas; esta entrega não cria uma proibição adicional para atribuí-los diretamente em outros fluxos.

## Erros esperados

| HTTP | Situação                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| 400  | Nome ausente, vazio, não textual ou acima do limite; ID não inteiro; busca informada com menos de dois caracteres |
| 401  | Sessão ausente ou inválida                                                                                        |
| 403  | Perfil sem acesso; CSRF ausente/incorreto; origem não permitida; troca de senha obrigatória pendente              |
| 404  | ID inexistente em edição ou alteração de situação                                                                 |
| 409  | Nome duplicado ou conflito de transações simultâneas                                                              |

Utilizar a mensagem em `message` da resposta. Para senha provisória, a resposta também contém `trocarSenhaNoProximoLogin: true`; a camada atual da API do frontend já trata esse marcador. Na edição de um ID inexistente para um nome que pertence a outro cadastro, a verificação de duplicidade pode retornar 409 antes da tentativa de atualização.

## Validação automatizada

```powershell
npm run build
npm test
npm run test:e2e
npm run test:postgres
```

- Testes HTTP: executam guards, controllers, CSRF e DTOs reais, com sessões e serviços simulados. Não acessam PostgreSQL.
- Testes PostgreSQL: executam os serviços reais, duplicidade normalizada, operações simultâneas, listagem, edição, situação, referências de transfusão e vínculo de usuário.
- `test:postgres` carrega o `.env` local sem imprimir credenciais e aceita apenas `hemocentro_dev` em `localhost`/`127.0.0.1`. Requer permissão CREATE no banco e extensão `unaccent` já instalada em `public`.
- Cria um schema aleatório `hemocentro_teste_aux_` seguido de 16 caracteres hexadecimais; tabelas/fixtures ficam exclusivamente nele. Os testes verificam o schema efetivo da conexão.
- O schema recebe o modelo Prisma atual, sem seeds, sem aplicar migrações em `public` e sem redefinir o banco.
- Ao terminar, a suíte remove somente seu próprio schema, verifica que ele não existe e compara as contagens públicas de instituições, colaboradores, transfusões e usuários.
- Executar sem operações de cadastro concorrentes na aplicação, pois a comparação dessas contagens deve permanecer estável. Se o processo for encerrado à força, a limpeza pode não executar; nesse caso conferir apenas schemas com esse prefixo e identificar a execução antes de remover qualquer um.

## Integração sugerida para o frontend

Página `Cadastros Auxiliares`, exclusiva do gestor, com abas Colaboradores/Instituições, busca por nome, filtro de situação, cadastro, edição e confirmação de inativação/reativação. Ao salvar, tratar erros sem apagar o texto digitado e atualizar as listagens após sucesso. Nas fichas, continuar usando as rotas operacionais de ativos; para referências antigas inativas, preservar o valor já vinculado.

## Pendências separadas desta entrega

- Referência visual: considerar exclusivamente a área destacada por Igor na fotografia; localidades e linhas fora desse destaque não fazem parte da lista desta tarefa. Esta entrega aproveita os cadastros da migração da Taynah, sem alterar essa lista ou reexecutar seus inserts.
- A associação automática de instituição com município não foi alterada neste commit de gerenciamento. Eventuais ajustes nessa regra e na lista inicial devem ser tratados separadamente, sem editar migrações já aplicadas.
- Integração das instituições nas telas de revisão/prontuário e opções clínicas atualizadas: confirmar com as responsáveis pelo frontend.
- Outros pedidos do PDF (reconhecimento de paciente, dados prévios, upload duplicado, inativação de ficha etc.) continuam como tarefas próprias. Este trabalho cobre o backend de administração dos cadastros auxiliares.
- Não foram criadas migrações novas nesta entrega. As seis migrações da Taynah já foram aplicadas anteriormente pelo usuário, totalizando 21.
