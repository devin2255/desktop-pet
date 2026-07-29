# Contributing

Thanks for helping improve Desktop Pet Player.

## Development environment

- Windows 10 or later
- Node.js 24 (minimum supported version: 22.12)
- Python 3.11 or later

```powershell
python -m pip install --requirement requirements-dev.txt
npm ci
npm test
npm start
```

## Pull requests

Keep player behavior generic and place pet identity, animation paths, and personality in `pet.json`. Add or update tests for manifest, archive, renderer, or animation-processing changes. Run `npm test` before opening a pull request.

Never commit customer photos, customer `.petpack` files, build outputs, local runtime reports, credentials, or generated work directories. Test packages must use assets you have permission to redistribute.

Security vulnerabilities should follow `SECURITY.md`, not a public issue.
