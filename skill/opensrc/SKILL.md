---
name: opensrc
description: |
  Fetch source code for npm packages, PyPI packages, Rust crates, and GitHub repositories. Use when you need to understand implementation details beyond TypeScript types, explore package internals, debug dependency behavior, or analyze how a library works under the hood. Triggers: "fetch source for X", "how does package X work internally", "show me the implementation of X", "get the source code for X", "why is X behaving this way", "debug X dependency", "understand X library", "what does X do under the hood".
---

# opensrc

Fetch source code for packages and repositories to understand implementation details beyond types.

## When to Use

Use opensrc when you need to:

- Understand how a dependency implements a feature (not just its types)
- Debug unexpected behavior in a third-party library
- Find where an error is thrown or a function is defined
- Understand the internals before filing a bug report
- Learn patterns from well-designed libraries
- Verify if a bug is in your code or a dependency

## Quick Start Examples

```bash
npx opensrc zod                    # npm package (installed version)
npx opensrc react@18.0.0           # specific version
npx opensrc pypi:requests          # PyPI package
npx opensrc crates:serde           # Rust crate
npx opensrc vercel/next.js         # GitHub repo
npx opensrc vercel/next.js@v14.0.0 # specific tag/branch
npx opensrc zod react react-dom    # multiple packages
```

## Registry Prefixes

| Registry  | Prefixes                     | Example                  |
| --------- | ---------------------------- | ------------------------ |
| npm       | (default), `npm:`            | `opensrc zod`            |
| PyPI      | `pypi:`, `pip:`, `python:`   | `opensrc pypi:requests`  |
| crates.io | `crates:`, `cargo:`, `rust:` | `opensrc crates:serde`   |
| GitHub    | `github:`, `owner/repo`, URL | `opensrc facebook/react` |

## CLI Commands

### fetch (default)

```bash
opensrc zod                # Auto-detect installed version
opensrc zod@3.22.0         # Specific version
opensrc facebook/react     # GitHub repo
opensrc owner/repo@v1.0.0  # Specific tag
opensrc owner/repo#main    # Specific branch
```

### list

```bash
opensrc list        # Show all fetched sources
opensrc list --json # Machine-readable output
```

### remove / rm

```bash
opensrc remove zod          # Remove by package name
opensrc rm zod react        # Remove multiple
opensrc remove facebook/react  # Remove by repo
```

### clean

```bash
opensrc clean             # Remove all sources
opensrc clean --packages  # All packages only
opensrc clean --repos     # Repos only
opensrc clean --npm       # npm packages only
opensrc clean --pypi      # PyPI packages only
opensrc clean --crates    # crates only
```

## Version Detection (npm)

Priority order for detecting installed version:

1. `node_modules/{package}/package.json` (most accurate)
2. `package-lock.json`
3. `pnpm-lock.yaml`
4. `yarn.lock`
5. `package.json` dependencies (fallback)

## Storage Structure

```
opensrc/
├── settings.json     # Modification preferences
├── sources.json      # Index of fetched packages
└── repos/
    └── github.com/
        └── {owner}/
            └── {repo}/    # Source code here
```

**Path to source:** `opensrc/repos/{host}/{owner}/{repo}/`

The `sources.json` file tracks what's available:

```json
{
  "packages": [
    {
      "name": "zod",
      "version": "3.22.0",
      "path": "opensrc/repos/github.com/colinhacks/zod"
    }
  ],
  "repos": [{ "owner": "facebook", "repo": "react", "ref": "v18.2.0" }]
}
```

## Project Integration

On first run, opensrc prompts to modify project files:

| File            | Modification                       |
| --------------- | ---------------------------------- |
| `.gitignore`    | Adds `opensrc/`                    |
| `tsconfig.json` | Adds `opensrc` to exclude          |
| `AGENTS.md`     | Adds source code reference section |

**AGENTS.md section example:**

```markdown
## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.
```

This ensures AI agents know source code is available for reference.

## Options

| Flag             | Purpose                                |
| ---------------- | -------------------------------------- |
| `--cwd <path>`   | Working directory                      |
| `--modify`       | Allow file modifications (skip prompt) |
| `--modify=false` | Deny file modifications (skip prompt)  |

## Common Workflows

### Understand a bug in a dependency

```bash
npx opensrc zod
# Then read opensrc/repos/github.com/colinhacks/zod/src/
```

### Compare implementations across versions

```bash
npx opensrc react@18.0.0
# Analyze, then clean and fetch different version
npx opensrc clean --npm
npx opensrc react@18.2.0
```

### Debug with both package and related repo

```bash
npx opensrc zod
npx opensrc colinhacks/zod  # Latest from repo
# Compare installed version vs current development
```

## Troubleshooting

### "Version not found"

- Verify package is installed: `npm ls <package>`
- Check available versions: `npm view <package> versions`
- Specify version explicitly: `opensrc <package>@<version>`

### "Tag not found" / Wrong version fetched

- Package versions may not map 1:1 to git tags
- Tool tries `v{version}` then `{version}` (e.g., `v3.22.0`, then `3.22.0`)
- Falls back to default branch if no matching tag
- Fetch directly with tag: `opensrc owner/repo@v1.0.0`

### "Repository URL missing"

Some packages don't specify `repository` in package.json. Solutions:

- Find the repo manually and use: `opensrc owner/repo`
- Check npm registry: `npm view <package> repository`

### "Permission denied" / File modifications blocked

- Use `--modify` to allow: `opensrc zod --modify`
- Or manually add `opensrc/` to `.gitignore`

### Monorepo packages (e.g., Babel, React)

- Tool detects `repository.directory` in package.json
- Entire repo is cloned, subdirectory is noted in `sources.json`
- Source path may be: `opensrc/repos/github.com/facebook/react/packages/react/`

### GitLab / Bitbucket support

```bash
opensrc https://gitlab.com/user/repo
opensrc bitbucket:owner/repo
```

Both are supported via URL or prefix.
