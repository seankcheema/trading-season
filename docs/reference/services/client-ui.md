# Client UI

**Folder:** `apps/client-ui` | **Port:** 4200 | **Framework:** Angular 21+

The primary user-facing application for the Trading Season platform. Provides login, registration, and a dashboard with live market data and trading capabilities.

## Workspace name note

The npm workspace is named `business-logic-ui` in `package.json`, not `client-ui`. Use `npm --workspace business-logic-ui ...` for all workspace-scoped commands; `--workspace client-ui` will not resolve.

## Implemented features

- User authentication (login and registration)
- Protected dashboard for authenticated users
- Live market data display (tickers, candles, snapshots)
- Order submission and management
- Account and holdings overview
- Session timeout with automatic logout
- Responsive layout for desktop browsers

## Backend integration

| Concern | Service | Port | Configuration |
| --- | --- | --- | --- |
| Authentication | Auth Service | 3001 | Direct HTTP calls |
| Everything else (`/api/*`) | Order and Sell Service | 8081 | Dev proxy (`proxy.conf.json`) |

**Important:** There is no route to Holdings and Trade Service (port 8082) anywhere in this application. All backend API calls go to Order and Sell Service.

## Development setup

```powershell
# From repository root
npm ci
npm --workspace business-logic-ui start
```

The dev server runs on `http://localhost:4200` with proxy forwarding configured to port 8081.

## Known gaps in this service's own README

The `apps/client-ui/README.md` describes account management and holdings dashboard features as backed by "planned account endpoints" that may not be fully implemented in the backend. Verify current status in the [API Reference](../api.md) and [Holdings and Trade Service documentation](holdings-and-trade-service.md) before assuming any dashboard feature beyond login/registration is live end-to-end.

## Component structure

The application uses shared Angular components from the [shared component library](../../packages/shared-ui-components/README.md) for consistent UI across modules.

## Testing

E2E tests are located in `apps/client-ui/e2e/` and use Playwright. Run tests with:

```powershell
npm --workspace business-logic-ui test
```

## See also

- [Architecture Reference](../architecture.md) for system-level design
- [API Reference](../api.md) for available endpoints
- [Holdings and Trade Service](holdings-and-trade-service.md) – the backend this app actually calls
