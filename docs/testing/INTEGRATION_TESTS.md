# Integration Testing Guide

Unit tests (`bun test`) mock `fetch` and run anywhere. Integration tests call a **real Kan** and are
skipped unless `INTEGRATION_TEST=true` and the credentials are set.

| File | Covers | Needs |
|------|--------|-------|
| `tests/integration/tools.test.ts` | Every tool except attachments: workspace, member, board, list, label, card, checklist, comment, health | `KAN_API_KEY`, `KAN_API_BASE_URL` |
| `tests/integration/attachment.test.ts` | `attachment.*` including the 50 MB limit and removal from the storage | the above, `KAN_TEST_CARD_ID` and a Kan with S3-compatible storage |

Both create their own data (a workspace named `IT <suffix>`), clean it up and never touch other
workspaces. Use a throwaway Kan, not production: an interrupted run may leave test data behind.

Kan answers requests above the API key's rate limit (100 per minute) with `401 Unauthorized`. The
tools suite waits for the window to reset and retries, so a full run takes about 1 to 2 minutes.

The easiest way to run them is the disposable stack below, which creates the user, the API key and the
test card for you.

## Attachment tests against a local Kan (no account needed)

`tests/integration/attachment.test.ts` runs against a disposable stack (Kan `latest`, Postgres and an
S3-compatible storage) started with Docker. Linux only, because the compose file uses the host network.

```bash
./scripts/integration-up.sh          # starts the stack, creates user, API key, workspace, board and card
set -a; . ./.env.integration; set +a # KAN_API_KEY, KAN_API_BASE_URL, KAN_TEST_CARD_ID
INTEGRATION_TEST=true bun test tests/integration/attachment.test.ts
docker compose -f docker-compose.integration.yml down -v   # tear down
```

Requirements: Docker Compose, `curl` >= 7.75 and `python3`. `.env.integration` is git-ignored.

The tests cover add (file, base64), list, download (SHA-256 compared with the original), remove, the
exact 50 MB limit (50 MB accepted, 50 MB + 1 byte rejected) and the error paths. Last verified against
Kan 0.6.0.

### Against an external S3 (e.g. Cloudflare R2)

Put the storage settings in a file outside the repository and point the script at it:

```bash
# r2.env: S3_ENDPOINT, S3_REGION=auto, S3_FORCE_PATH_STYLE=true, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
#         NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME, NEXT_PUBLIC_AVATAR_BUCKET_NAME,
#         NEXT_PUBLIC_STORAGE_URL, NEXT_PUBLIC_STORAGE_DOMAIN
KAN_IT_ENV_FILE=/secure/path/r2.env ./scripts/integration-up.sh
```

The buckets must already exist. Use a dedicated test bucket and a token limited to it. Keys are
`<test workspace id>/<card id>/...`, so objects created by the tests are easy to find.

Kan deletes the storage object on a best-effort basis and only logs failures, so a broken storage
configuration still lets `attachment.remove` report success. The integration test therefore checks the
storage URL: 200 before the removal and 404 after it. If it fails there, look for
`Failed to delete attachment from S3` in the Kan logs (typical causes: token without delete permission,
or a TLS interception proxy whose CA the Kan container does not trust).
