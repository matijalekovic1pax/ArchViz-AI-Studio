# ArchWiz MCP Servers

This directory contains MCP servers for operating the ArchWiz app from Codex.

## Testing MCP Server

`mcp/archwiz-test-mcp-server.mjs` is a browser automation MCP dedicated to testing ArchWiz like a user would. It launches or connects to a Chrome-compatible browser through Chrome DevTools Protocol, opens the app with a gated test bridge enabled, and exposes tools for upload, settings, prompts, generation, visual selections, screenshots, and result capture.

### What It Can Do

- `archwiz_launch_app`
- `archwiz_test_healthcheck`
- `archwiz_get_state`
- `archwiz_get_prompt`
- `archwiz_select_workflow`
- `archwiz_upload_image`
- `archwiz_set_prompt`
- `archwiz_apply_settings`
- `archwiz_draw_visual_selection`
- `archwiz_click_canvas`
- `archwiz_generate`
- `archwiz_get_render`
- `archwiz_screenshot`
- `archwiz_run_generation_scenario`
- `archwiz_reset_project`

### Setup

1. Start the app:

```bash
npm run dev
```

2. Optional: copy the env template if the app or browser path differs from the defaults:

```bash
cp mcp/archwiz-test-mcp.env.example .env.archwiz-test-mcp
```

3. Add the MCP server to Codex:

```bash
codex mcp add archwiz-test -- node /ABSOLUTE/PATH/TO/REPO/mcp/archwiz-test-mcp-server.mjs
```

For this repo specifically:

```bash
codex mcp add archwiz-test -- node /Users/macbookpro/Documents/AVAS/AVAS/mcp/archwiz-test-mcp-server.mjs
```

4. Verify from Codex by calling:

```text
archwiz_test_healthcheck
archwiz_launch_app
archwiz_get_state
```

### Run Manually

```bash
npm run mcp:test
```

### Notes

- The app exposes `window.__ARCHWIZ_TEST_HOOKS__` only when opened with `?archwizTest` or when `localStorage["archwiz:test"]` is set to `1`.
- In Vite dev mode, `?archwizTest` also enables a local test-auth bypass so the MCP can reach the app shell. Real AI generation still requires a valid gateway session/token.
- Browser actions still go through the real UI for uploads, generate clicks, canvas clicks, screenshots, and drawn visual selections.
- Saved screenshots and renders default to `/tmp/archwiz-test-mcp` unless `ARCHWIZ_TEST_OUTPUT_DIR` is set.

## Feedback MCP Server

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
