import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // The auth guard reads the stored session, which only exists in the browser. Prerendering
  // the dashboard would run the guard at build time with no session and bake in a redirect.
  { path: 'dashboard', renderMode: RenderMode.Client },
  // The token arrives as a query parameter, which a prerender does not have. Rendering this
  // route at build time would bake in the "no token" state and flash it before hydration.
  { path: 'reset-password', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
