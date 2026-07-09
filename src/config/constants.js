export const APP_VERSION = '3.1.8-modular-step-7';
export const PUBLIC_BASE_URL = new URL(import.meta.env.BASE_URL || './', document.baseURI);

export const KDF_ITERATIONS = 310000;
export const MIN_PASSWORD_LENGTH = 14;
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 5;
export const LEGACY_STORE = 'lifehub.v2.state';
export const ENC_STORE = 'lifehub.v3.encrypted.state';
export const AUTO_LOCK_MINUTES = 15;
export const PDF_DB = 'lifehub-local-archive';
export const PDF_STORE = 'payrollFiles';
export const VAULT_STORE = 'vaultFiles';
