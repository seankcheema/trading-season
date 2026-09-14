# Shared UI Components - SpartanNG Component Library

Reusable Angular UI components built with SpartanNG and TailwindCSS, shared across all Angular applications in the monorepo.

## 📋 Overview

**Technology:** Angular 22.1, TypeScript, TailwindCSS 4.3.3, SpartanNG 1.3.4  
**Package Manager:** npm (npm workspace in monorepo)  
**Purpose:** Centralized, reusable component library

## 🎯 Exported Components

Each component includes TypeScript class, HTML template, and CSS styles.

| Component | Purpose | Usage |
|-----------|---------|-------|
| **HlmButton** | Styled button element | `<hlm-button>Click Me</hlm-button>` |
| **HlmCard** | Card container layout | Wraps content with header/footer |
| **HlmCardHeader** | Card header section | Title area |
| **HlmCardTitle** | Card title text | Large heading |
| **HlmCardDescription** | Card description | Subtitle/meta info |
| **HlmCardContent** | Card body content | Main content area |
| **HlmCardFooter** | Card footer section | Action area |
| **HlmCardAction** | Card action element | Secondary action |
| **HlmField** | Form field wrapper | Contains label + input |
| **HlmInput** | Text input field | User text entry |
| **HlmLabel** | Form label | Associated with input |
| **HlmSelect** | Custom select dropdown | Styled select |
| **HlmNativeSelect** | Native HTML select | HTML5 select |
| **HlmSeparator** | Visual divider | Horizontal/vertical line |

## 🚀 Quick Start

### Installation (Already in monorepo)
```bash
cd packages/shared-ui-components
npm install
```

### Using in Apps

**Import components:**
```typescript
import { HlmButton } from '@packages/shared-ui-components';
import { HlmCard, HlmCardContent } from '@packages/shared-ui-components';
```

**Use in template:**
```html
<hlm-card>
  <div hlm-card-header>
    <h2 hlm-card-title>Welcome</h2>
  </div>
  <div hlm-card-content>
    <p>Card content goes here</p>
  </div>
</hlm-card>
```

**Use button:**
```html
<button hlm-button>Primary Action</button>
<button hlm-button variant="outline">Secondary Action</button>
<button hlm-button disabled>Disabled Button</button>
```

## 📁 Project Structure

```
packages/shared-ui-components/
├── src/
│   ├── lib/
│   │   ├── hlm-button.ts           ← Button component
│   │   ├── hlm-button.token.ts     ← Button token (styles)
│   │   ├── hlm-card.ts             ← Card component
│   │   ├── hlm-card.token.ts       ← Card token
│   │   ├── hlm-card-header.ts      ← Card header
│   │   ├── hlm-card-title.ts
│   │   ├── hlm-card-description.ts
│   │   ├── hlm-card-content.ts
│   │   ├── hlm-card-footer.ts
│   │   ├── hlm-card-action.ts
│   │   ├── hlm-field.ts            ← Form field wrapper
│   │   ├── hlm-input.ts            ← Text input
│   │   ├── hlm-label.ts            ← Form label
│   │   ├── hlm-select.ts           ← Custom select
│   │   ├── hlm-native-select.ts    ← HTML select
│   │   └── hlm-separator.ts        ← Divider
│   └── index.ts                    ← Public API
├── package.json
├── tsconfig.json
├── README.md                       ← This file
└── .agent.md                       ← AI guidance
```

## 🎨 Styling & TailwindCSS

All components use **TailwindCSS 4.3.3** utilities for styling.

### Design System
- **Base unit:** 4px (px-1 = 4px, px-4 = 16px, etc.)
- **Colors:** Primary (blue), secondary (gray), success, danger
- **Typography:** Standard font hierarchy
- **Spacing:** Consistent padding/margin
- **Responsive:** Mobile-first breakpoints (sm, md, lg, xl)

### Customization
Components accept TailwindCSS class props:

```typescript
@Component({
  selector: 'hlm-button',
  template: `<button [class]="customClass">{{ label }}</button>`,
  inputs: ['customClass', 'label']
})
export class HlmButtonComponent {}
```

**Usage:**
```html
<button hlm-button class="w-full bg-red-600">Full Width Red Button</button>
```

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@angular/core` | ^22.0.0 | Angular framework |
| `tailwindcss` | ^4.3.3 | Utility CSS |
| `@spartan-ng/ui` | ^1.3.4 | SpartanNG components |

## 🧪 Testing

### Run Tests
```bash
npm run test
```

### Test Structure
```
src/lib/
├── hlm-button.ts
└── hlm-button.spec.ts       ← Unit tests
```

### Example Test
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HlmButtonComponent } from './hlm-button';

describe('HlmButtonComponent', () => {
  let component: HlmButtonComponent;
  let fixture: ComponentFixture<HlmButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HlmButtonComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HlmButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render button', () => {
    expect(component).toBeTruthy();
  });
});
```

## 📚 API Documentation

### HlmButton
```typescript
@Component({
  selector: 'button[hlm-button]',
  inputs: [
    'variant',      // 'default' | 'outline' | 'ghost' | 'destructive'
    'size',         // 'sm' | 'md' | 'lg' | 'icon'
    'disabled',     // boolean
    'loading'       // boolean (shows spinner)
  ]
})
```

**Example:**
```html
<button hlm-button variant="outline" size="lg">Large Outline Button</button>
```

### HlmField
Wraps input + label with validation.

```typescript
@Component({
  selector: 'hlm-field',
  inputs: [
    'label',       // string
    'error',       // string (error message)
    'required',    // boolean
    'hint'         // string (helper text)
  ]
})
```

**Example:**
```html
<hlm-field label="Email" error="Invalid email" required>
  <input hlm-input type="email" placeholder="Enter email">
</hlm-field>
```

### HlmSelect
Styled select dropdown.

```html
<select hlm-select>
  <option value="">Select option</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

## 🤝 Contributing New Components

### 1. Create Component Files
```bash
touch src/lib/hlm-my-component.ts
touch src/lib/hlm-my-component.spec.ts
```

### 2. Implement Component
```typescript
// src/lib/hlm-my-component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'hlm-my-component',
  standalone: true,
  template: '<div>My Component</div>',
  styleUrl: './hlm-my-component.css'
})
export class HlmMyComponentComponent {}
```

### 3. Add to Public API
Edit `src/index.ts`:
```typescript
export * from './lib/hlm-my-component';
```

### 4. Write Tests
```typescript
// src/lib/hlm-my-component.spec.ts
describe('HlmMyComponentComponent', () => {
  it('should create', () => {
    // Test implementation
  });
});
```

### 5. Update README
Document the new component above.

## 🚀 Publishing

### To npm (Future)
```bash
npm run build
npm publish
```

### For Monorepo (Current)
Already available via npm workspace reference:
```typescript
import { HlmButton } from '@packages/shared-ui-components';
```

## 📞 Support

- **Component not found?** Check [index.ts](src/index.ts) for public API
- **Styling issues?** Verify TailwindCSS is configured in importing app
- **TypeScript errors?** Run `npm run lint` for diagnostics

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa Frontend Team
