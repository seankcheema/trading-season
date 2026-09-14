# Business Logic UI - AI Agent Guidance

This file provides AI agents with guidance for working in the `apps/business-logic-ui` Angular frontend.

## Directory Purpose

**Angular 22.1** trading dashboard and authentication UI. Standalone components, reactive forms, TailwindCSS styling.

**Tech Stack:**
- Angular 22.1 (latest)
- TypeScript (strict mode)
- TailwindCSS 4.3.3 (utility CSS)
- Vitest (unit testing)
- SpartanNG UI (reusable components from `packages/shared-ui-components`)

**Runs on:** http://localhost:4200  
**Backend:** http://localhost:8080  

---

## When to Modify This App

✅ **Modify here:**
- Add new UI screens/components (login, dashboard, etc.)
- Update form validation
- Fix frontend bugs
- Add new tests (`.spec.ts` files)
- Update component styles (`.css` files)
- Modify Angular configuration (`angular.json`, `tsconfig.json`)

❌ **Do NOT modify:**
- Backend business logic (see `apps/business-backend/`)
- Shared UI components (see `packages/shared-ui-components/`)
- API contract definitions (see `packages/api-contracts/`)
- Docker infrastructure (see `infrastructure/`)
- Database schema (see `apps/business-backend/db/migrations/`)

---

## File Organization

```
apps/business-logic-ui/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   ├── login.component.ts         ← Component logic
│   │   │   ├── login.component.html       ← Template
│   │   │   ├── login.component.css        ← Styles
│   │   │   └── login.component.spec.ts    ← Unit tests
│   │   ├── register/
│   │   │   └── [same structure]
│   │   ├── app.routes.ts                  ← Route definitions
│   │   ├── app.component.ts               ← Root component
│   │   ├── app.config.ts                  ← App configuration
│   │   ├── app.config.server.ts           ← Server config (SSR)
│   │   └── app.routes.server.ts           ← Server routes (SSR)
│   ├── main.ts                            ← Bootstrap entry
│   ├── main.server.ts                     ← SSR bootstrap
│   ├── server.ts                          ← Express server
│   ├── index.html
│   ├── styles.css                         ← Global styles
│   └── ...
├── angular.json                           ← Build config
├── tsconfig.json                          ← TS config (base)
├── tsconfig.app.json                      ← TS config (app)
├── tsconfig.spec.json                     ← TS config (tests)
├── package.json                           ← Dependencies
├── Dockerfile                             ← Container image
└── README.md                              ← User guide

```

---

## Common Tasks

### Add a New Component
```bash
# Create folder
mkdir -p src/app/dashboard

# Create files
touch src/app/dashboard/dashboard.component.ts
touch src/app/dashboard/dashboard.component.html
touch src/app/dashboard/dashboard.component.css
touch src/app/dashboard/dashboard.component.spec.ts
```

**Template (.ts file):**
```typescript
import { Component } from '@angular/core';
import { HlmButton } from '@packages/shared-ui-components';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [HlmButton],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent { }
```

### Add a New Route
Edit `src/app/app.routes.ts`:
```typescript
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent }
];
```

### Use Shared UI Components
```typescript
import { HlmButton } from '@packages/shared-ui-components';
import { HlmCard, HlmCardContent } from '@packages/shared-ui-components';

// In component imports:
@Component({
  imports: [HlmButton, HlmCard, HlmCardContent],
  // ...
})
```

### Add Unit Tests
```typescript
// login.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

### Build & Run
```bash
# Development
npm run dev

# Production build
npm run build

# Test
npm run test

# Lint
npm run lint

# Docker build
docker build -t dualeapa-business-ui:latest .
```

---

## Important Files to Know

| File | Purpose |
|------|---------|
| `angular.json` | Build config, development server settings, build options |
| `tsconfig.json` | TypeScript compiler options (base config) |
| `tsconfig.app.json` | App-specific TS options (extends tsconfig.json) |
| `tsconfig.spec.json` | Test-specific TS options |
| `package.json` | Dependencies, build scripts, workspace config |
| `src/app/app.routes.ts` | Route definitions for the app |
| `src/app/app.config.ts` | App providers & configuration |
| `src/main.ts` | Bootstrap entry point |
| `src/styles.css` | Global CSS (TailwindCSS directives) |
| `Dockerfile` | Container image definition |

---

## Path Aliases (TypeScript Imports)

Reference shared packages via npm workspace:
```typescript
// ✅ Correct (uses npm workspace alias)
import { HlmButton } from '@packages/shared-ui-components';

// ❌ Wrong (relative path)
import { HlmButton } from '../../../packages/shared-ui-components';
```

**Configuration in `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "paths": {
      "@packages/*": ["../../packages/*"]
    }
  }
}
```

---

## Angular 22.1 Specifics

- **Standalone components:** No NgModule (all components use `standalone: true`)
- **Reactive Forms:** Use `FormBuilder`, `FormGroup`, `FormControl`
- **Server-side rendering:** `@angular/ssr` pre-configured
- **Build tool:** Webpack via Angular CLI
- **Development server:** `ng serve` (configured in `angular.json`)

---

## Environment Configuration

Create `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};
```

Use in services:
```typescript
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  login(credentials: any) {
    return this.http.post(`${environment.apiUrl}/api/auth/login`, credentials);
  }
}
```

---

## Debugging

### Enable Console Logs
```typescript
console.log('Debug:', value);
```

### Angular DevTools
Install [Angular DevTools](https://angular.io/guide/devtools) extension for Chrome.

### Browser DevTools
Press F12, use Sources tab to set breakpoints.

### Check Network Tab
Monitor API calls to backend (http://localhost:8080).

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Shared component not found | Incorrect import path | Use `@packages/shared-ui-components` |
| Backend not responding | Backend not running | Start backend: `mvn spring-boot:run` in `apps/business-backend/` |
| Styles not applied | TailwindCSS not compiled | Run `npm install` and restart dev server |
| Tests fail | Dependencies missing | Run `npm install` in app directory |
| TypeScript errors | Config issue | Run `npm run lint` for details |

---

## Quick Links

- **Root README:** [README.md](../../README.md)
- **Main Documentation:** [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- **Development Setup:** [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md)
- **Shared Components:** [packages/shared-ui-components/README.md](../../packages/shared-ui-components/README.md)
- **Backend API:** [apps/business-backend/README.md](../business-backend/README.md)

---

**Last Updated:** 2026-09-09
