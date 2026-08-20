const ADMIN_EMAILS = new Set(["kbartczak34@gmail.com"]);

const AUTH_EMAIL_HEADERS = [
  "cf-access-authenticated-user-email",
  "oai-authenticated-user-email",
] as const;

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

export function getAuthenticatedEmail(request: Request) {
  for (const headerName of AUTH_EMAIL_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) return value.trim().toLowerCase();
  }
  return null;
}

export function isAdminRequest(request: Request) {
  return isAdminEmail(getAuthenticatedEmail(request));
}
