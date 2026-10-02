# Shared component instructions

- Keep reusable presentation here and application-specific behavior in the consuming app.
- Follow existing Hlm naming, variants, accessibility semantics, and styling utilities.
- Expose additions through the appropriate subpath index and its entry in [tsconfig.json](../tsconfig.json)'s `paths`; avoid inventing an unconfigured root barrel. This is local source compiled directly into client-ui's TypeScript program, not an installed package, so `paths` is the only resolution mechanism.
- Preserve consumer compatibility or update affected consumers in the same change.
- Verify through the consuming Angular build and relevant tests; source exports are compiled by consumers.
