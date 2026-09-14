# Auth service instructions

- Preserve ESM .js extensions in local TypeScript imports and follow existing NestJS module/provider patterns.
- Keep credentials and token persistence in this service's database; Java users are separate.
- Keep runtime and CLI migration lists aligned, add migrations instead of editing applied ones, and leave synchronize disabled.
- Access tokens are RS256 JWTs; refresh tokens are opaque, hashed server-side, rotated, and revocable. Do not interchange them.
- Preserve generic credential errors and existing failed-login protections. Never add fallback signing keys.
- Use ephemeral keys in tests. Verify contract changes against controller, strategy, service, and tests together; the existing logout mismatch is documented in the [API reference](../../docs/reference/api.md#current-logout-limitation).
- Use the [local README](README.md) for setup and commands.
