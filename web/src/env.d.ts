/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CTMS_ORIGIN?: string
  readonly VITE_ADMIN_KEY?: string
  readonly VITE_PROGRESS_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
