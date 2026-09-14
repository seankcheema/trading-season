# Business Logic UI - Angular 22.1 Frontend

The trading dashboard and authentication interface for the DuaLEAPa trading simulation platform.

## 📋 Overview

**Technology:** Angular 22.1, TypeScript, TailwindCSS 4.3.3, SpartanNG UI Components, Vitest  
**Port:** http://localhost:4200  
**Node Version:** 22.x  

## 🎯 Features

- **Login Component** — User authentication with email validation
- **Register Component** — New trader registration with form validation
- **Trading Dashboard** — Market simulation interface (WIP)
- **Shared UI Components** — Reusable buttons, cards, forms, inputs from `packages/shared-ui-components`

## 🚀 Quick Start

### Prerequisites
- Node.js 22.x
- npm 10+

### Installation
```bash
cd apps/business-logic-ui
npm install
```

### Development Server
```bash
npm run dev
```
Runs on http://localhost:4200 with hot reload enabled.

### Build for Production
```bash
npm run build
```
Output is in the `dist/` directory.

### Run Tests
```bash
npm run test
```
Tests run with Vitest. Coverage report available after completion.

### Linting
```bash
npm run lint
```
ESLint checks code style (Prettier formatting).

---

## 📁 Project Structure

```
apps/business-logic-ui/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   ├── login.component.ts
│   │   │   ├── login.component.html
│   │   │   ├── login.component.css
│   │   │   └── login.component.spec.ts
│   │   ├── register/
│   │   │   ├── register.component.ts
│   │   │   ├── register.component.html
│   │   │   ├── register.component.css
│   │   │   └── register.component.spec.ts
│   │   ├── app.routes.ts         ← Routes definition
│   │   ├── app.component.ts       ← Root component
│   │   └── app.config.ts          ← App configuration
│   ├── main.ts                    ← Application entry point
│   ├── index.html
│   └── styles.css                 ← Global styles
├── angular.json                   ← Angular build configuration
├── tsconfig.json                  ← TypeScript configuration
├── tsconfig.app.json              ← App-specific TypeScript config
├── tsconfig.spec.json             ← Test TypeScript config
├── package.json
├── Dockerfile                     ← Container image
└── README.md                       ← This file
```

---

## 🧩 Using Shared UI Components

Shared components are in `packages/shared-ui-components` and imported via npm package reference:

```typescript
import { HlmButton } from '@packages/shared-ui-components';
import { HlmCard, HlmCardContent, HlmCardHeader } from '@packages/shared-ui-components';
```

**Available Components:**
- `HlmButton` — Styled button
- `HlmCard`, `HlmCardHeader`, `HlmCardTitle`, `HlmCardDescription`, `HlmCardContent`, `HlmCardFooter`, `HlmCardAction` — Card container
- `HlmField` — Form field wrapper
- `HlmInput` — Text input
- `HlmLabel` — Form label
- `HlmSelect`, `HlmNativeSelect` — Dropdown selects
- `HlmSeparator` — Visual divider

See [packages/shared-ui-components/README.md](../../packages/shared-ui-components/README.md) for detailed API documentation.

---

## 🔗 API Integration

### Backend Endpoints
All API calls go to `http://localhost:8080` (configured in environment).

**Authentication Endpoints:**
- `POST /api/auth/login` — User login
- `POST /api/auth/register` — New user registration
- `POST /api/auth/refresh` — Refresh JWT token
- `POST /api/auth/verify` — Verify token validity

**Stored JWT tokens in `localStorage`:**
```typescript
localStorage.setItem('auth_token', response.token);
const token = localStorage.getItem('auth_token');
```

**TODO:** Create centralized `AuthService` for token management.

### Environment Configuration
```typescript
// environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};

// environment.prod.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com'
};
```

---

## 🎨 Styling & TailwindCSS

This project uses **TailwindCSS 4.3.3** for styling.

### Utility Classes
```html
<button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Click Me
</button>
```

### Component Styles
Each component has a `.css` file for component-specific styles. Global styles in `src/styles.css`.

### Design System
- **Colors:** Use TailwindCSS color palette (blue, green, red, etc.)
- **Typography:** Consistent font sizes via TailwindCSS
- **Spacing:** 4px base unit (px-4 = 16px, etc.)
- **Responsive:** Mobile-first with `sm:`, `md:`, `lg:`, `xl:` breakpoints

---

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Test File Structure
- Component tests: `*.spec.ts` in same directory as component
- Test framework: Vitest
- Example: `src/app/login/login.component.spec.ts`

### Running Specific Tests
```bash
npm run test -- login.component.spec.ts
```

### Coverage Report
```bash
npm run test -- --coverage
```

---

## 🐛 Debugging

### Debug in Browser
1. Run `npm run dev`
2. Open http://localhost:4200
3. Press F12 to open DevTools
4. Set breakpoints in TypeScript source (Angular devtools extension recommended)

### Console Logs
```typescript
console.log('Debug message:', variable);
```

### Angular DevTools
Install [Angular DevTools](https://angular.io/guide/devtools) Chrome extension for component inspection.

---

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

### Docker
```bash
docker build -t dualeapa-business-ui:latest .
docker run -p 4200:4200 dualeapa-business-ui:latest
```

### Environment Variables
Set via `docker run` or `.env` file:
```bash
ANGULAR_APP_API_URL=https://api.example.com
```

---

## 📚 Documentation

For full development setup and troubleshooting, see:
- [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md) — Local setup guide
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — System architecture
- [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md) — API endpoints

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `@angular/core` | Angular framework |
| `@angular/forms` | Reactive forms |
| `@angular/router` | Routing |
| `@angular/ssr` | Server-side rendering |
| `tailwindcss` | Utility-first CSS |
| `vitest` | Unit testing |
| `@spartan-ng/ui-button` | SpartanNG button component |

---

## ✅ Checklist for New Contributors

- [ ] Node.js 22.x installed
- [ ] Run `npm install`
- [ ] Run `npm run dev` (should start on localhost:4200)
- [ ] Open http://localhost:4200 in browser
- [ ] Try logging in (connects to backend)
- [ ] Read [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md)
- [ ] Review [packages/shared-ui-components/README.md](../../packages/shared-ui-components/README.md)

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa Frontend Team
