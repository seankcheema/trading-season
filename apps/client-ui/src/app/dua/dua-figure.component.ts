import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Dua's expressions. Shy covers both eyes with its flippers and peek lowers one of them, for
// fields Dua should not watch being typed; worried is for something that went wrong.
export type DuaMood = 'happy' | 'sleepy' | 'shy' | 'peek' | 'worried' | 'excited';

let nextFigureId = 0;

// Dua, drawn as a vector traced from the launcher artwork in public/assets/assistant, so the
// same face can change expression and stand on its own without the round frame. The drawing
// keeps its light face in both themes, from the --dua-face tokens. Purely decorative: whatever
// Dua says is text beside it.
@Component({
  selector: 'app-dua-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-mood]': 'mood()',
    '[class.wiggle]': 'wiggle()',
  },
  template: `
    <svg viewBox="0 0 512 512" focusable="false">
      @if (framed()) {
        <defs>
          <clipPath [attr.id]="clipId"><circle cx="256" cy="256" r="256" /></clipPath>
        </defs>
        <circle class="face" cx="256" cy="256" r="256" />
      }
      <g class="art" [attr.clip-path]="clip()">
        <path class="fin" d="M238 272 C240 238 258 206 296 190 C294 216 294 244 299 272" />
        <path
          class="head"
          d="M104 512 L104 470 C104 340 188 265 253 265 C368 265 409 410 409 470 L409 512"
        />
        <path class="line" d="M357 388 L375 363 M364 424 L386 396" />
        @switch (mood()) {
          @case ('sleepy') {
            <path class="line thin" d="M197 360 Q211.5 374 226 360 M285 360 Q299.5 374 314 360" />
            <ellipse class="ink" cx="256" cy="430" rx="10" ry="12" />
          }
          @case ('excited') {
            <path class="line thin" d="M196 368 Q211.5 344 227 368 M284 368 Q299.5 344 315 368" />
            <path class="mouth" d="M226 414 Q256 458 286 414 Z" />
          }
          @case ('worried') {
            <path class="line thin" d="M190 330 L226 316 M322 330 L286 316" />
            <circle class="ink" cx="211.5" cy="359.5" r="16" />
            <circle class="ink" cx="299.5" cy="359.5" r="16" />
            <path class="line thin" d="M232 432 Q244 420 256 430 Q268 440 280 428" />
            <path
              class="drop"
              d="M414 268 C426 290 434 302 434 314 A20 20 0 0 1 394 314 C394 302 402 290 414 268 Z"
            />
          }
          @default {
            <circle class="ink" cx="211.5" cy="359.5" r="16" />
            <circle class="ink" cx="299.5" cy="359.5" r="16" />
            <path class="line" d="M230 422 Q256 444 282 422" />
          }
        }
        <!-- Always drawn, below the frame unless the mood raises them, so they slide in. -->
        <path
          class="flipper flipper-left"
          d="M150 540 C152 450 170 380 206 346 C230 326 252 340 244 368 C236 398 214 440 210 540"
        />
        <path
          class="flipper flipper-right"
          d="M361 540 C359 450 341 380 305 346 C281 326 259 340 267 368 C275 398 297 440 301 540"
        />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .face,
    .art {
      fill: var(--dua-face);
    }

    .art {
      stroke: var(--dua-face-ink);
      stroke-width: 20;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .head {
      stroke-linecap: butt;
    }

    .line {
      fill: none;
    }

    .thin {
      stroke-width: 14;
    }

    .ink {
      fill: var(--dua-face-ink);
      stroke: none;
    }

    .mouth {
      fill: var(--dua-face-ink);
      stroke-width: 10;
    }

    .drop {
      fill: var(--dua-face-accent);
      stroke-width: 10;
    }

    .fin {
      transform-box: view-box;
      transform-origin: 270px 262px;
    }

    :host(.wiggle) .fin {
      animation: dua-fin-wiggle 600ms ease-in-out;
    }

    .flipper {
      stroke-width: 14;
      transform: translateY(240px);
      transform-box: fill-box;
      transform-origin: center;
      transition: transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1);
    }

    :host([data-mood='shy']) .flipper,
    :host([data-mood='peek']) .flipper-left {
      transform: none;
    }

    :host([data-mood='peek']) .flipper-right {
      transform: translate(18px, 52px) rotate(14deg);
    }

    @keyframes dua-fin-wiggle {
      0%,
      100% {
        transform: rotate(0deg);
      }
      20% {
        transform: rotate(5deg);
      }
      45% {
        transform: rotate(-4deg);
      }
      70% {
        transform: rotate(3deg);
      }
      85% {
        transform: rotate(-1.5deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .flipper {
        transition: none;
      }

      :host(.wiggle) .fin {
        animation: none;
      }
    }
  `,
})
export class DuaFigureComponent {
  readonly mood = input<DuaMood>('happy');
  // In the round frame, as on the launcher; unframed, the head stands alone, open at the bottom,
  // for Dua to peek over or rise out of something.
  readonly framed = input(true);
  // Waggles the fin once each time this turns on.
  readonly wiggle = input(false);

  protected readonly clipId = `dua-figure-clip-${nextFigureId++}`;
  protected readonly clip = computed(() => (this.framed() ? `url(#${this.clipId})` : null));
}
