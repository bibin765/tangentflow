# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in TangentFlow, please report it responsibly:

1. **Do NOT open a public GitHub issue**
2. Email: security@tangentflow.com
3. Include: description, steps to reproduce, potential impact

We will acknowledge receipt within 48 hours and provide a fix within 7 days for critical issues.

## Supply Chain Security

- **npm provenance**: All versions from v0.3.0+ are published via GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), linking each published version to its exact source commit.
- **Minimal dependencies**: The package has zero runtime dependencies. Only peer dependencies (`@chenglou/pretext`) and optional dependencies (`canvas` for Node.js).
- **Pinned versions**: Peer dependencies use `^` ranges (not `>=`) to prevent unexpected major version changes.
- **Source verification**: Compare the published package against the GitHub source at `packages/core/src/`.

## Verifying Package Integrity

```bash
# Check provenance of a published version
npm audit signatures

# Compare published files against source
npm pack @upbrew/tangentflow --dry-run
```
