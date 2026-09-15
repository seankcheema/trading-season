# Infrastructure instructions

- Resolve build contexts and mounted file paths relative to the Compose file, not the shell working directory.
- Keep business and auth database credentials, ports, and volumes separate.
- Inspect the actual Jenkins agent configuration; the optional image does not configure the native agent.
- Preserve required test reporting and make missing toolchains visible as failures.
- Document operational changes in the [operations guide](../docs/guides/operations.md). Do not present development examples as production-ready deployment.
