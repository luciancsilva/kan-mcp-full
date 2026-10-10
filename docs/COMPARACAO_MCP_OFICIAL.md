# Comparação: MCP oficial do Kan x kan-mcp (este repositório)

Data: 2026-10-10. Alvo: Kan 0.6.0 (`ghcr.io/kanbn/kan:latest`).

## Como foi feito

- O código do MCP oficial (`kanbn/kan`, `packages/mcp`, branch `main` de 2026-10-02) foi **lido**. O MCP oficial **não foi executado**.
- Cada requisição que as ferramentas do oficial fazem foi reproduzida com `curl` contra o Kan 0.6.0 local (com S3 de verdade) para checar o comportamento.
- O nosso MCP foi testado ferramenta por ferramenta contra o mesmo Kan (`tests/integration`).
- Nada do código do oficial (AGPL-3.0) foi copiado: as ferramentas foram escritas a partir do OpenAPI público do Kan (`/api/v1/openapi.json`).

## Resultado: todas as funções do oficial estão presentes

O oficial tem 46 ferramentas. O nosso MCP tem as 46 (algumas com outro nome) e mais as que o oficial não tem.

| Oficial | Nosso | Observação |
|---|---|---|
| `list_workspaces` | `workspace.list` | |
| `find_workspace_by_name` | `workspace.findByName` | **Adicionada nesta rodada** |
| `get_workspace` | `workspace.getById` | |
| `get_workspace_by_slug` | `workspace.getBySlug` | Ver "Defeitos do Kan" |
| `create_workspace` / `update_workspace` / `delete_workspace` | `workspace.create` / `update` / `delete` | |
| `search_workspace` | `workspace.search` | |
| `check_workspace_slug_availability` | `workspace.checkSlugAvailability` | Ver "Defeitos do Kan" |
| `list_boards` | `board.list` | |
| `find_board_by_name` | `board.findByName` | **Adicionada.** Busca por ID do workspace (o oficial, por nome) |
| `get_board` | `board.getById` | Filtros diferentes, ver abaixo |
| `get_board_by_slug` | `board.getBySlug` | Só boards públicos, nos dois |
| `create_board` / `update_board` / `delete_board` | `board.create` / `update` / `delete` | |
| `create_card` / `get_card` / `update_card` / `delete_card` | `card.create` / `getById` / `update` / `delete` | |
| `duplicate_card` | `card.duplicate` | **Adicionada** |
| `get_card_activities` | `card.listActivities` | |
| `add_card_comment` / `update_card_comment` / `delete_card_comment` | `comment.add` / `update` / `delete` | |
| `toggle_card_label` | `card.addLabel` + `card.removeLabel` | Idempotentes (o oficial só alterna) |
| `toggle_card_member` | `card.addMember` + `card.removeMember` | Idempotentes |
| `create_checklist`, `update_checklist`, `delete_checklist` | `checklist.create` / `update` / `delete` | |
| `create_checklist_item`, `update_checklist_item`, `delete_checklist_item` | `checklist.addItem` / `updateItem` / `deleteItem` | |
| `create_label`, `get_label`, `update_label`, `delete_label` | `label.create` / `getById` / `update` / `delete` | |
| `create_list`, `update_list`, `delete_list` | `list.create` / `update` / `delete` | |
| `invite_member` | `member.invite` | **Adicionada** |
| `remove_member` | `member.remove` | **Adicionada** |
| `update_member_role` | `member.updateRole` | **Adicionada** |
| `get_workspace_invite_link` | `workspace.getInviteLink` | **Adicionada** |
| `create_workspace_invite_link` | `workspace.createInviteLink` | **Adicionada** |
| `deactivate_workspace_invite_links` | `workspace.deactivateInviteLinks` | **Adicionada** |

## O que só o nosso tem

- **Anexos:** `attachment.add`, `attachment.list`, `attachment.remove`, `attachment.download` (o oficial não tem nenhuma ferramenta de anexo).
- `server.health` e 3 resources (`kan://stats`, board por ID, board por slug).
- Retry com backoff e timeout no cliente HTTP (o oficial não tem).
- Mensagens de erro com o motivo devolvido pelo Kan, inclusive os campos inválidos.
- `card.update` move o card de lista (`listPublicId` + `index`) e aceita `dueDate: null` para limpar a data.
- `board.create` aceita listas, labels, template e, opcionalmente, slug e visibilidade.
- Add/remove de label e membro idempotentes.

## Diferenças de comportamento verificadas

| Tema | Oficial | Nosso |
|---|---|---|
| Filtros do `get_board` | Envia `labelPublicId` e `memberPublicId`. **A API ignora esses nomes**: com um filtro de label o board continuou devolvendo os 2 cards, nosso filtro devolveu 1. | Envia `labels`, `members`, `lists`, `dueDateFilters`, `type` com os nomes que o Kan lê. |
| Filtros em lista | Não suporta. | O Kan rejeita **um único valor** em parâmetro de lista (exige repetição). Quando há um valor só, ele é enviado duas vezes. |
| Anexos | Ausentes. | Completos, testados com 50 MB e com Cloudflare R2. |

## Defeitos do próprio Kan 0.6.0 (afetam os dois MCPs)

1. `GET /workspaces/{slug}` e `GET /workspaces/{publicId}` colidem: pedir por slug cai no handler de ID e responde "Workspace not found". Por isso a ferramenta `get_workspace_by_slug` do oficial **falha**. A nossa resolve o slug pela lista de workspaces e funciona.
2. `GET /workspaces/check-slug-availability` cai no mesmo handler errado. Nenhum dos dois consegue usá-lo. A nossa devolve um erro explicando; o `workspace.create` informa slug em uso.
3. `GET /workspaces/{ws}/boards/{slug}` devolve `null` (HTTP 200) para board privado. A nossa ferramenta explica; o oficial devolve `null`.
4. `GET /stats` exige a chave de admin do servidor: chave de usuário recebe 401.
5. O limite de 100 requisições por minuto por chave é respondido com `401 Unauthorized`, não 429, então o retry automático não ajuda. Os testes de integração esperam a janela renovar.
6. `DeleteObject` no S3 é "best effort": se falhar (permissão, TLS), o Kan só registra no log e apaga o registro. O teste de integração confere o storage.

## Defeitos do código herdado que foram corrigidos

O repositório base (`michaelruelas/kan-mcp`) foi escrito para uma API antiga. No primeiro teste contra o Kan 0.6.0, **36 de 41 chamadas falharam**. Parte foi em cascata: `board.create` usava uma rota que não existe, então as chamadas seguintes ficaram sem ID. As falhas diretas eram `workspace.getBySlug`, `workspace.checkSlugAvailability`, `workspace.update` (PATCH em vez de PUT), `workspace.search`, `board.create`, `board.list`, `board.getBySlug` e `board.checkSlugAvailability`, além do formato dos filtros de lista (vírgula em vez de parâmetro repetido). Os 33 testes unitários antigos que afirmavam essas rotas também foram substituídos.

Foram corrigidas rotas, métodos, parâmetros obrigatórios novos (`workspacePublicId` na busca, `boardPublicId` na checagem de slug do board, `workspaceSlug` e `boardSlug` no board por slug) e o formato dos filtros. As ferramentas de card, label, lista, checklist e comentário só falharam em cascata ou por PATCH/PUT, e passaram a funcionar após a correção.

Mudanças de entrada que quebram compatibilidade com a versão 0.2.0:

| Ferramenta | Antes | Agora |
|---|---|---|
| `workspace.search` | `query` | `workspacePublicId` + `query` |
| `workspace.create` | `slug` obrigatório | `slug` opcional |
| `board.list` | `workspacePublicId?`, `visibility?` | `workspacePublicId`, `type?`, `archived?` |
| `board.create` | `slug` e `visibility` obrigatórios | só `workspacePublicId` e `name`; `lists`, `labels`, `type`, `slug`, `visibility` opcionais |
| `board.getBySlug` | `workspacePublicId` + `slug` | `workspaceSlug` + `boardSlug` |
| `board.checkSlugAvailability` | `workspacePublicId` + `slug` | `boardPublicId` + `slug` |
| `workspace.update` | `weekStartDay` texto | `weekStartDay` número (0 a 6) |

## Ainda não coberto por nenhum dos dois MCPs

Operações do OpenAPI do Kan 0.6.0 sem ferramenta, nem no oficial: webhooks (5), papéis e permissões (10), usuário (`/users/me`, atualizar, senha), convites (`/invites/*`), integrações e importações (Trello, GitHub). Podem entrar se houver uso.
