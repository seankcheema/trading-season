/** Where each process of the suite listens; see playwright.config.ts. */
export const UI_PORT = 4390;
export const SERVICE_PORT = 8390;
export const AUTH_PORT = 3390;

/** The auth stand-in's own address, for the one route a test calls on it directly. */
export const AUTH_STANDIN_URL = `http://127.0.0.1:${AUTH_PORT}`;
