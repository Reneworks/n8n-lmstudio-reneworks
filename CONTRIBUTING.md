# Contributing to n8n-nodes-lmstudio-reneworks

Thanks for your interest in contributing! This node package connects n8n with LM Studio and MCP servers, so we value contributions that keep it useful and reliable.

## How to contribute

- **Report a bug**: open an [issue](https://github.com/Reneworks/n8n-lmstudio-reneworks/issues) with the mode you are using (native, chat or responses), your LM Studio version, and a minimal reproduction if possible.
- **Request a feature**: open an issue describing the use case and the expected behavior.
- **Submit code**: fork the repository, make your changes on a branch, and open a pull request.

## Development setup

```bash
npm install
npm test
```

To verify everything before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

## Code style

- The project is formatted with Prettier. Run `npm run format` before committing.
- TypeScript strict mode is used. New code must compile with `npm run typecheck`.
- Keep existing behavior covered: the test suite in `test/` must stay green.

## Commits

Use clear, conventional commit messages describing what changed and why.

## Testing a change locally

Each test file in `test/` builds request payloads against the three API modes and validates the parsing of responses. If you change payload construction or response handling, extend the corresponding test.