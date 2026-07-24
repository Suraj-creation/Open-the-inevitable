/// <reference types="vite/client" />

/** Vite handles CSS imports (including package CSS like katex's) at build time. */
declare module "*.css";

interface ImportMetaEnv {
  /** Origin of the Surface Gateway for a split deploy (web on one host, gateway on another).
   *  Empty in local dev → the Vite proxy forwards relative `/api` to the gateway (ADR-0062 deploy). */
  readonly VITE_API_BASE?: string;
}
