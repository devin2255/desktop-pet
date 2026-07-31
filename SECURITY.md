# Security Policy

## Supported versions

Security fixes are provided for the latest `0.4.x` release line. Older development snapshots are unsupported.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting or open a private security advisory. Do not publish a working exploit, malicious `.petpack`, private pet photo, customer package, or personal data in a public issue.

Please include the affected version, Windows version, reproduction steps, and the smallest safe test package you can provide. Maintainers will acknowledge a report within seven days and coordinate disclosure after a fix is available.

## Security boundaries

`.petpack` files are untrusted input. The player rejects unsafe paths, duplicate or case-colliding entries, unreferenced files, oversized archives, malformed manifests, and invalid PNG assets before extraction. Reports that bypass these checks are especially valuable.
