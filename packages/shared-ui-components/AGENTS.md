# Shared component instructions

- Keep reusable presentation here and application-specific behavior in the consuming app.
- Follow existing Hlm naming, variants, accessibility semantics, and styling utilities.
- Expose additions through the appropriate subpath index and package.json exports; avoid inventing an unconfigured root barrel.
- Preserve consumer compatibility or update affected consumers in the same change.
- Verify through the consuming Angular build and relevant tests; source exports are compiled by consumers.
