# Feedback MCP Server

This MCP server lets Codex access and manage feedback reports one-by-one without manual copy/paste.

## What It Can Do

- `feedback_list_reports`
- `feedback_claim_next_report`
- `feedback_get_report_detail`
- `feedback_get_report_snapshot`
- `feedback_add_comment`
- `feedback_update_report`
- `feedback_resolve_report`
- `feedback_delete_report`
- `feedback_healthcheck`

## Setup

1. Copy example env file:

```bash
cp mcp/feedback-mcp.env.example .env.feedback-mcp
```

2. Fill credentials in `.env.feedback-mcp`:
- Recommended: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Optional: gateway mode with `FEEDBACK_API_BASE_URL` + `FEEDBACK_API_TOKEN`

3. Add MCP server to Codex:

```bash
codex mcp add archviz-feedback -- node /ABSOLUTE/PATH/TO/REPO/mcp/feedback-mcp-server.mjs
```

For this repo specifically:

```bash
codex mcp add archviz-feedback -- node /Users/macbookpro/Documents/AVAS/AVAS/mcp/feedback-mcp-server.mjs
```

4. Verify:

```bash
codex mcp get archviz-feedback
```

Then call the `feedback_healthcheck` tool from Codex.

## Run Manually

```bash
npm run mcp:feedback
```

## Notes

- `.env.feedback-mcp` is gitignored by existing `.gitignore` rules.
- Snapshot payloads can be large. `feedback_get_report_snapshot` omits `appState` by default unless `includeAppState=true`.
- Image preview base64 can also be large. `feedback_get_report_detail` omits `previewDataUrl` by default unless `includePreviewData=true`.
