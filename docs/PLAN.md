# Plano: MCP do Kan com suporte a anexos

> **Status (2026-10-10):** fases 0 a 3 concluídas e validadas contra o Kan 0.6.0 (inclui `attachment.download`).
> Também foram corrigidas as rotas herdadas e adicionadas as ferramentas que faltavam em relação ao MCP oficial.
> Ver `docs/COMPARACAO_MCP_OFICIAL.md`. A fase 4 (PR upstream) segue em aberto.

Data: 2026-10-09

## Objetivo

Incluir, remover, listar e baixar anexos de cards do Kan (https://github.com/kanbn/kan) via MCP.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Base | Fork do `michaelruelas/kan-mcp` (MIT), mantendo licença e créditos em `NOTICE` |
| Execução | Local via stdio. Fonte do arquivo por `filePath`, `url` ou `contentBase64` |
| Instância | Self-hosted com S3 ou MinIO |
| Escopo | Incluir, remover, listar e baixar anexos |

## Diagnóstico

- Nenhum MCP existente tem anexos: o oficial (`kanbn/kan`, `packages/mcp`, AGPL-3.0, 11 ferramentas de card) e o `michaelruelas/kan-mcp` (MIT, Bun, 40 ferramentas, retry e timeout no cliente).
- O MCP oficial usa um cliente só JSON, sem retry nem timeout.
- A API REST do Kan já tem os endpoints de anexo (router `attachment.ts`), todos com permissão `card:edit`:

| Endpoint | Entrada | Saída |
|---|---|---|
| `POST /cards/{cardPublicId}/attachments/upload-url` | `filename` (1 a 255), `contentType`, `size` (máx. 50 MB) | `{ url, key }`, PUT pré-assinado válido por 1 h |
| `POST /cards/{cardPublicId}/attachments/confirm` | `s3Key`, `filename`, `originalFilename`, `contentType`, `size` | Registro do anexo; grava atividade `attachment.added` |
| `DELETE /attachments/{attachmentPublicId}` | nenhuma além do ID | `{ success }`; soft delete, apaga o objeto no S3 em best effort |

- Existe também `POST /api/upload/attachment` (corpo cru, header `x-original-filename`, query `cardPublicId`), usado pela interface web. Não confirmado se aceita API key.

## Riscos

- O `confirm` não verifica se o objeto existe no S3. O MCP só pode confirmar depois de um PUT com status 2xx, senão fica anexo fantasma.
- A URL pré-assinada aponta para o endpoint S3 do Kan. Se for MinIO interno, o MCP precisa alcançá-lo de onde roda.
- `/api/download/attatchment` é um proxy sem autenticação, com CVE já corrigido na 0.5.5. Não será usado.
- Leitura de arquivo local: restringir a um diretório raiz.
- Download por URL: proteger contra SSRF.
- Não há endpoint oficial de download autenticado. Hipótese: `card.getById` devolve URL assinada de leitura por anexo. A Fase 0 confirma.

## Fases

### Fase 0: validar na instância (depende do Lucian)

Com `KAN_API_KEY` e URL base, executar:

1. `GET /cards/{id}`: o payload traz anexos, `publicId` e URL assinada de leitura?
2. `POST .../attachments/upload-url`: retorna `url` e `key`?
3. PUT do arquivo na `url` e depois `POST .../attachments/confirm`.
4. `DELETE /attachments/{id}`.

Verificar também se o endpoint S3 é alcançável de onde o MCP roda.

Se a URL de leitura não vier no payload: contribuir com endpoint no upstream, ou entregar `attachment.download` fora do escopo inicial (recomendado, para não travar o objetivo principal).

### Fase 1: base

- Importar `michaelruelas/kan-mcp` com `NOTICE` de atribuição.
- Rodar `bun test` e typecheck como linha de base.
- Alinhar variáveis: `KAN_API_KEY`, `KAN_API_BASE_URL`.

### Fase 2: ferramentas de anexo (`src/tools/attachment.ts`)

| Ferramenta | Entrada | Comportamento |
|---|---|---|
| `attachment.add` | `cardPublicId`; uma fonte entre `filePath`, `url`, `contentBase64`; `filename` e `contentType` opcionais | Detecta MIME, valida 50 MB, faz upload-url, PUT e confirm. Só confirma se o PUT deu 2xx |
| `attachment.list` | `cardPublicId` | Lista `publicId`, nome, tamanho, tipo e data |
| `attachment.remove` | `attachmentPublicId` | DELETE e resultado |
| `attachment.download` | `attachmentPublicId` | Salva em `KAN_MCP_DOWNLOAD_DIR` e devolve o caminho; inline para texto ou imagem pequena. Depende da Fase 0 |

Segurança:

- `KAN_MCP_UPLOAD_ROOT` restringe `filePath` e bloqueia path traversal.
- `url` de entrada: só http e https, bloqueio de IPs privados (liberável por variável), sem seguir redirect para fora.
- Limite de tamanho para base64 e para download.
- Sem retry automático no PUT (URL de uso único, reenvio pode duplicar).

### Fase 3: testes e documentação

- Testes unitários com S3 simulado.
- Integração com `docker-compose` (Kan, Postgres, MinIO), rodada com `INTEGRATION_TEST=true`.
- README em português com configuração do cliente MCP e variáveis novas.

### Fase 4 (opcional): PR upstream

Reescrever as ferramentas no padrão zod e vitest de `kanbn/kan` e propor em `packages/mcp`.

## Variáveis de ambiente previstas

| Variável | Uso |
|---|---|
| `KAN_API_KEY` | Chave da API do Kan (obrigatória) |
| `KAN_API_BASE_URL` | URL base da API (ex.: `https://kan.exemplo.com/api/v1`) |
| `KAN_MCP_UPLOAD_ROOT` | Diretório permitido para `filePath` |
| `KAN_MCP_DOWNLOAD_DIR` | Destino dos downloads |
| `KAN_MCP_ALLOW_PRIVATE_URLS` | Libera `url` para IPs privados (padrão: bloqueado) |

## Fontes

- https://github.com/kanbn/kan
- https://github.com/michaelruelas/kan-mcp
- https://github.com/kanbn/kan/issues/638 (storage de anexos hoje preso ao SDK da AWS)
