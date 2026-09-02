# ForgeKit Game Assets MCP

ForgeKit is a Model Context Protocol server for building visually distinct HTML Canvas and Three.js games with AI agents. It gives Codex, Claude Code, Claude Desktop, and other MCP clients structured access to:

- 192 transparent sprites across eight original visual worlds
- Ten dependency-free browser-game modules with 116 exports
- Exact atlas frame numbers and crop coordinates
- Individual 256 × 256 sprite extraction as MCP image content
- Genre-aware art, palette, module, and asset recommendations
- Complete Canvas and Three.js starter files
- Safe local export of selected atlases and modules into a game project
- Read-only remote HTTP access with downloadable asset and module URLs

The art and code remain MIT licensed. The MCP server does not require an API key.

## Zero-install quick start

Use this canonical Streamable HTTP endpoint in any MCP client:

```text
https://ai-game-asset-library.vercel.app/mcp
```

The hosted server is public, read-only, and requires no clone, npm install, local runtime, or API key.

### Codex

Add it from the CLI:

```bash
codex mcp add forgekit --url https://ai-game-asset-library.vercel.app/mcp
```

Or add this to `~/.codex/config.toml` (or a trusted project's `.codex/config.toml`):

```toml
[mcp_servers.forgekit]
url = "https://ai-game-asset-library.vercel.app/mcp"
startup_timeout_sec = 20
tool_timeout_sec = 60
```

In the ChatGPT desktop app or Codex IDE extension, select **MCP servers → Add server → Streamable HTTP** and paste the same URL. Restart the client, then use `/mcp` to verify it.

### Claude Code

```bash
claude mcp add --transport http --scope user forgekit https://ai-game-asset-library.vercel.app/mcp
claude mcp get forgekit
```

For a project-scoped `.mcp.json`, copy `examples/claude-remote.mcp.json` or use:

```json
{
  "mcpServers": {
    "forgekit": {
      "type": "http",
      "url": "https://ai-game-asset-library.vercel.app/mcp"
    }
  }
}
```

### Any MCP harness

Choose the **Streamable HTTP** transport and use the canonical URL. For clients that accept the common `mcpServers` JSON shape, copy `mcp-config.json`:

```json
{
  "mcpServers": {
    "forgekit": {
      "type": "streamable-http",
      "url": "https://ai-game-asset-library.vercel.app/mcp"
    }
  }
}
```

Machine-readable discovery metadata is available in `server.json`, using the official MCP Registry schema.

## Requirements for local or self-hosted use

- Node.js 22.13 or newer
- npm 10 or newer

## Optional local installation

```bash
git clone https://github.com/buildfastwithai/gen-ai-experiments.git
cd gen-ai-experiments/skills/ai-game-asset-library
npm install
npm run build
```

Run the full protocol test suite:

```bash
npm test
```

## Connect Codex locally with STDIO

Use an absolute path to `dist/stdio.js`. `FORGEKIT_OUTPUT_ROOT` is the only directory that `export_game_kit` may write beneath.

```bash
codex mcp add forgekit \
  --env FORGEKIT_OUTPUT_ROOT=/absolute/path/to/your/game-projects \
  -- node /absolute/path/to/gen-ai-experiments/skills/ai-game-asset-library/dist/stdio.js
```

Equivalent `~/.codex/config.toml` configuration:

```toml
[mcp_servers.forgekit]
command = "node"
args = ["/absolute/path/to/gen-ai-experiments/skills/ai-game-asset-library/dist/stdio.js"]
env = { FORGEKIT_OUTPUT_ROOT = "/absolute/path/to/your/game-projects" }
startup_timeout_sec = 20
tool_timeout_sec = 60
```

Restart the Codex client after adding the server, then use `/mcp` or `codex mcp list` to verify it is connected.

## Connect Claude Code locally with STDIO

Claude Code supplies `CLAUDE_PROJECT_DIR` to local MCP servers automatically, so `export_game_kit` writes only beneath the project where Claude was started.

```bash
claude mcp add --transport stdio --scope user forgekit \
  -- node /absolute/path/to/gen-ai-experiments/skills/ai-game-asset-library/dist/stdio.js
```

Verify with:

```bash
claude mcp list
```

Remote and local Claude Code project configurations are available at `examples/claude-remote.mcp.json` and `examples/claude.mcp.json`. The local file requires `FORGEKIT_MCP_ROOT`.

## Claude Desktop JSON

Add the server to the `mcpServers` object in Claude Desktop's configuration, using absolute paths:

```json
{
  "mcpServers": {
    "forgekit": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/ai-game-asset-library/dist/stdio.js"],
      "env": {
        "FORGEKIT_OUTPUT_ROOT": "/absolute/path/to/your/game-projects"
      }
    }
  }
}
```

Restart Claude Desktop after saving the configuration.

## Public endpoints

The production deployment is public and does not require an API key:

- MCP: `https://ai-game-asset-library.vercel.app/mcp`
- Health: `https://ai-game-asset-library.vercel.app/health`
- Manifest: `https://ai-game-asset-library.vercel.app/asset-manifest.json`
- MCP Registry manifest: `https://ai-game-asset-library.vercel.app/server.json`
- Generic client config: `https://ai-game-asset-library.vercel.app/mcp-config.json`
- Assets: `https://ai-game-asset-library.vercel.app/assets/<atlas-name>.png`
- Modules: `https://ai-game-asset-library.vercel.app/lib/<module-name>.js`

The service root returns copy-paste connection commands and links to the generic configuration and MCP Registry manifest.

## Run a self-hosted Streamable HTTP server

GitHub stores the source and assets but does not run an MCP process. Deploy `dist/http.js` to a Node host for a URL that anyone can connect to.

Local HTTP development:

```bash
npm run start:http
```

The default endpoints are:

- MCP: `http://127.0.0.1:3333/mcp`
- Health: `http://127.0.0.1:3333/health`
- Manifest: `http://127.0.0.1:3333/asset-manifest.json`
- Assets: `http://127.0.0.1:3333/assets/<atlas-name>.png`
- Modules: `http://127.0.0.1:3333/lib/<module-name>.js`

Production environment:

```bash
HOST=0.0.0.0 \
PORT=3333 \
FORGEKIT_ALLOWED_HOSTS=mcp.example.com \
FORGEKIT_PUBLIC_BASE_URL=https://mcp.example.com \
npm run start:http
```

For multiple public hostnames, use a comma-separated `FORGEKIT_ALLOWED_HOSTS` value. Put HTTPS and authentication in front of the Node process when exposing it publicly.

Connect Codex to a self-hosted endpoint:

```bash
codex mcp add forgekit --url https://mcp.example.com/mcp
```

Connect Claude Code to a self-hosted endpoint:

```bash
claude mcp add --transport http --scope user forgekit https://mcp.example.com/mcp
```

## Docker

```bash
docker build -t forgekit-mcp .
docker run --rm -p 3333:3333 \
  -e FORGEKIT_ALLOWED_HOSTS=localhost,127.0.0.1 \
  forgekit-mcp
```

For a public domain, set `FORGEKIT_ALLOWED_HOSTS` and `FORGEKIT_PUBLIC_BASE_URL` to that domain and HTTPS origin.

## Tools

| Tool | Purpose | Transport |
|---|---|---|
| `list_asset_packs` | Discover visual worlds, styles, genres, and frame IDs | STDIO + HTTP |
| `search_assets` | Search all sprites and return exact frame/crop metadata | STDIO + HTTP |
| `get_sprite` | Return one cropped transparent PNG and its metadata | STDIO + HTTP |
| `get_atlas` | Return a complete atlas, frame list, and optional PNG | STDIO + HTTP |
| `get_code_module` | Return a complete ForgeKit JavaScript module | STDIO + HTTP |
| `recommend_game_kit` | Recommend packs, palettes, modules, and sample assets | STDIO + HTTP |
| `create_game_starter` | Generate playable Canvas or Three.js starter files | STDIO + HTTP |
| `export_game_kit` | Copy selected assets, modules, and starters into a project | Local STDIO only |

## Resources and prompts

The server advertises 20 resources:

- `forgekit://catalog/manifest`
- `forgekit://docs/guide`
- Eight `forgekit://atlas/<pack-id>` PNG resources
- Ten `forgekit://module/<module-id>` JavaScript resources

It also supplies two reusable prompts:

- `build_game_with_forgekit`
- `reskin_game_with_forgekit`

## Recommended agent workflow

1. Call `recommend_game_kit` with the game idea and engine.
2. Keep one pack dominant and select no more than two supporting packs.
3. Call `search_assets` and record exact frame IDs and frame numbers.
4. Call `create_game_starter`.
5. In local mode, call `export_game_kit` to copy files into the project.
6. Implement and test the full game loop.
7. Vary palette, camera, interface, procedural seed, and mechanics between games.

Example request after connecting:

> Build a cozy farming game on a hostile moon using ForgeKit. Use Canvas 2D, choose one dominant visual world, search for exact sprites, export the kit into `moon-farm`, and create a complete playable prototype.

## Security behavior

- Discovery, image, module, recommendation, starter, resource, and prompt operations are read-only.
- `export_game_kit` exists only on the local STDIO transport.
- Export destinations must be relative and remain beneath `FORGEKIT_OUTPUT_ROOT`, `CLAUDE_PROJECT_DIR`, or the server working directory.
- Existing files are skipped by default. The tool overwrites only when the caller explicitly sets `overwrite: true`.
- HTTP host and browser-origin validation default to localhost. Public deployments must explicitly list their allowed hostnames.

## Library reference

See `FORGEKIT-README.md` for atlas layouts, module descriptions, and direct JavaScript examples. `asset-manifest.json` is the machine-readable source of truth.
