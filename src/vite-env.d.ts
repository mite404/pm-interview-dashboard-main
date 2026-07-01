/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_OPENROUTER_API_KEY: string;
  readonly VITE_OPENROUTER_MODEL?: string; // optional; defaults in openrouter.ts
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
