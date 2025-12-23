# naylence-create-ts

CLI to scaffold Naylence starter templates.

## Features

- **Interactive mode**: Select template and flavor via prompts
- **Non-interactive mode**: Specify template via flags
- **Local development**: Use local starters repo via `NAYLENCE_STARTERS_PATH`
- **GitHub fallback**: Fetch templates from GitHub when no local path

## Installation

```bash
# Global install (after publishing)
npm install -g naylence-create-ts

# Or use npx
npx naylence-create my-project
```

## Usage

```bash
# Interactive mode
naylence-create my-project

# Non-interactive mode
naylence-create my-project --template agent-on-sentinel --flavor ts

# List available templates
naylence-create --list

# With install
naylence-create my-project --template agent-on-sentinel --install
```

### Options

| Flag | Description |
|------|-------------|
| `-t, --template <id>` | Template ID (e.g., `agent-on-sentinel`) |
| `-f, --flavor <flavor>` | Template flavor (`ts`, `py`, `poly`). Default: `ts` |
| `-l, --list` | List available templates and exit |
| `--install` | Run package manager install after generation |
| `--no-install` | Skip install (default) |
| `--from-local` | Force reading from local starters path |
| `--from-github` | Force fetching from GitHub |
| `--ref <ref>` | Git ref for GitHub fetch (default: `main`) |
| `--starters-path <path>` | Path to local starters repo |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NAYLENCE_STARTERS_PATH` | Path to local starters repo (preferred for dev) |
| `NAYLENCE_STARTERS_GITHUB` | GitHub repo (default: `naylence/naylence-starters`) |
| `NAYLENCE_STARTERS_REF` | Default git ref for GitHub fetch |

## Development

### Setup

```bash
npm install
```

### Run from source

```bash
# List templates (using local starters)
NAYLENCE_STARTERS_PATH=../naylence-starters npm run dev -- --list

# Generate a project
NAYLENCE_STARTERS_PATH=../naylence-starters npm run dev -- ./my-project --template agent-on-sentinel
```

### Build

```bash
npm run build
```

### Run built CLI

```bash
npm run start -- --list
```

### Test

```bash
# Run unit tests
NAYLENCE_STARTERS_PATH=../naylence-starters npm test

# Run local generation test
./scripts/test-local.sh
```

## Project Structure

```
src/
├── cli.ts        # CLI entrypoint with commander
├── index.ts      # Public API exports
├── templates.ts  # Template discovery
├── generator.ts  # Project generation & placeholder substitution
├── github.ts     # GitHub tarball fetching
├── types.ts      # Shared types and constants
└── utils.ts      # Utility functions
tests/
└── generator.test.ts  # Unit tests
scripts/
└── test-local.sh      # Local testing script
```

## License

Apache-2.0
