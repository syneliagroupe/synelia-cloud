# Graphify MCP (Synelia workspace)

Knowledge graphs live under each repo’s `graphify-out/` (gitignored). [Graphify](https://github.com/Graphify-Labs/graphify) exposes them over MCP via `python -m graphify.serve <graph.json>`.

## Graphs (vm-admin, 2026-09-22)

| Repo | `graph.json` | Approx. scale (see `continue-graphify.md`) |
|------|----------------|---------------------------------------------|
| `synelia-cloud-backend` | `synelia-cloud-backend/graphify-out/graph.json` | ~4.6k nodes |
| `synelia-cloud` | `synelia-cloud/graphify-out/graph.json` | ~3k nodes |
| `synelia-cloud-mobile` | `synelia-cloud-mobile/graphify-out/graph.json` | ~1.2k nodes |

## Cursor

Project MCP config: [`/opt/synelia/.cursor/mcp.json`](/opt/synelia/.cursor/mcp.json) — three stdio servers (`graphify-backend`, `graphify-cloud`, `graphify-mobile`).

After editing the file, reload MCP in Cursor (Settings → MCP → refresh) or restart the IDE.

Each repo also has `.cursor/rules/graphify.mdc` (`graphify install --platform cursor`).

**Tools (typical):** `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`.

CLI equivalents (no MCP): from the repo root, `graphify query "…"`, `graphify path "A" "B"`, `graphify explain "…"`.

## OpenCode (optional)

Root [`/.opencode/opencode.json`](../../.opencode/opencode.json) mirrors the same three graphs. Python interpreter: `/opt/graphify/.local/share/uv/tools/graphifyy/bin/python` or `/root/.local/share/uv/tools/graphifyy/bin/python` (must match a `graphifyy` install with `[mcp]` extra).

## Keep graphs fresh

```bash
cd synelia-cloud-backend && graphify update .
cd synelia-cloud         && graphify update .
cd synelia-cloud-mobile  && graphify update .
```

AST-only, no LLM cost. Full re-cluster after large refactors: `/graphify .` in an assistant or `graphify update . --force`.

## HTTP transport (optional)

For a shared daemon instead of stdio:

```bash
/root/.local/share/uv/tools/graphifyy/bin/python -m graphify.serve \
  /opt/synelia/synelia-cloud-backend/graphify-out/graph.json \
  --transport http --host 127.0.0.1 --port 8765 --path /mcp
```

Then point Cursor at `http://127.0.0.1:8765/mcp` (set `GRAPHIFY_API_KEY` / `--api-key` if exposed beyond localhost).
