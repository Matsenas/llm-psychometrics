export function appBaseUrl() {
  return import.meta.env.VITE_APP_BASE_URL || window.location.origin;
}

export function appUrl(path: string) {
  return new URL(path, appBaseUrl()).toString();
}
