# Shared UI Components - AI Agent Guidance

Guidance for AI agents working with the SpartanNG component library.

## Directory Purpose

**Central component library** shared by all Angular apps via npm workspace.

**Tech Stack:**
- Angular 22.1
- TypeScript (strict mode)
- TailwindCSS 4.3.3
- SpartanNG 1.3.4

---

## When to Modify This Package

✅ **Modify here:**
- Add new reusable components (Button, Card, Form, etc.)
- Fix styling bugs across all apps
- Update TailwindCSS configuration
- Add new component variants
- Update component APIs
- Write component tests

❌ **Do NOT modify:**
- App-specific components (see `apps/business-logic-ui/`)
- API contracts (see `packages/api-contracts/`)
- Backend code (see `apps/business-backend/`)

---

## File Organization

```
packages/shared-ui-components/
├── src/
│   ├── lib/
│   │   ├── hlm-button.ts              ← Component class
│   │   ├── hlm-button.token.ts        ← Styling tokens
│   │   ├── hlm-button.spec.ts         ← Unit tests
│   │   ├── hlm-card.ts
│   │   ├── hlm-field.ts
│   │   ├── hlm-input.ts
│   │   ├── hlm-label.ts
│   │   ├── hlm-select.ts
│   │   ├── hlm-separator.ts
│   │   └── ... [more components]
│   └── index.ts                       ← Public API (export all)
├── package.json                       ← npm workspace package
├── tsconfig.json                      ← TypeScript config
└── README.md                          ← Documentation
```

---

## Common Tasks

### Add a New Component

**1. Create component file:**
```bash
touch src/lib/hlm-my-component.ts
touch src/lib/hlm-my-component.spec.ts
```

**2. Implement component:**
```typescript
// src/lib/hlm-my-component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'hlm-my-component',
  standalone: true,
  template: `<div>{{ label }}</div>`,
  styleUrl: './hlm-my-component.css'
})
export class HlmMyComponentComponent {
  @Input() label = 'Default label';
}
```

**3. Add to public API:**
```typescript
// src/index.ts
export * from './lib/hlm-my-component';
```

**4. Write tests:**
```typescript
// src/lib/hlm-my-component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HlmMyComponentComponent } from './hlm-my-component';

describe('HlmMyComponentComponent', () => {
  let component: HlmMyComponentComponent;
  let fixture: ComponentFixture<HlmMyComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HlmMyComponentComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HlmMyComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display label', () => {
    component.label = 'Test Label';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test Label');
  });
});
```

### Update Component Styles
```css
/* src/lib/hlm-button.css */
:host {
  @apply inline-flex items-center justify-center;
}

button {
  @apply px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700;
}
```

### Build Library
```bash
npm run build
# Output: dist/
```

### Test Components
```bash
npm run test              # Run all tests
npm run test -- --watch  # Watch mode
```

---

## Key Conventions

### Component Naming
- Prefix: `hlm-` (Helm/SpartanNG convention)
- Pattern: `hlm-[component-name]`
- Examples: `hlm-button`, `hlm-card`, `hlm-input`

### Token Files
`*.token.ts` files define styling constants:
```typescript
// hlm-button.token.ts
export const HLM_BUTTON_DEFAULT = 'px-4 py-2 bg-blue-600 text-white';
export const HLM_BUTTON_OUTLINE = 'px-4 py-2 border border-gray-300 text-gray-700';
```

### Standalone Components
All components use `standalone: true`:
```typescript
@Component({
  selector: 'hlm-my-component',
  standalone: true,      // ✅ Always standalone
  imports: [CommonModule], // ✅ Declare dependencies
  template: '...'
})
```

### Public API
Always export from `src/index.ts`:
```typescript
export * from './lib/hlm-button';
export * from './lib/hlm-card';
// ...
```

Apps import via:
```typescript
import { HlmButton, HlmCard } from '@packages/shared-ui-components';
```

---

## TailwindCSS Styling

### Using TailwindCSS Classes
```typescript
@Component({
  selector: 'hlm-button',
  template: `<button [class]="buttonClass">{{ label }}</button>`
})
export class HlmButtonComponent {
  buttonClass = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50';
}
```

### Variants
```typescript
@Component({
  selector: 'hlm-button'
})
export class HlmButtonComponent {
  @Input() variant: 'default' | 'outline' | 'ghost' = 'default';
  
  get buttonClass() {
    switch (this.variant) {
      case 'outline':
        return 'border border-gray-300 text-gray-700 hover:bg-gray-100';
      case 'ghost':
        return 'text-gray-600 hover:bg-gray-100';
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700';
    }
  }
}
```

---

## Import Path Aliases

Apps refer to this package via npm workspace:

```typescript
// ✅ Correct (npm workspace alias)
import { HlmButton } from '@packages/shared-ui-components';

// ❌ Wrong (relative path)
import { HlmButton } from '../../../packages/shared-ui-components';
```

**Configured in `tsconfig.json`:**
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

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Component not found in import | Not exported from `index.ts` | Add `export * from './lib/hlm-my-component'` |
| Styles not applying | TailwindCSS not compiled | Ensure importing app has TailwindCSS configured |
| TypeScript error: module not found | Incorrect import path | Use `@packages/shared-ui-components` |
| Tests failing | Missing TestBed setup | Ensure `TestBed.configureTestingModule()` includes imports |

---

## Quick Links

- **Root README:** [README.md](../../README.md)
- **Business Logic UI:** [apps/business-logic-ui/.agent.md](../../apps/business-logic-ui/.agent.md)
- **Development Workflow:** [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md)
- **Root Monorepo Guidance:** [.agent.md](../../.agent.md)

---

**Last Updated:** 2026-09-09
