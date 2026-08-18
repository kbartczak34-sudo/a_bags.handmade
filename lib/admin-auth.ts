const ADMIN_EMAILS = new Set(["kbartczak34@gmail.com"]);

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

export function isAdminRequest(request: Request) {
  return isAdminEmail(request.headers.get("oai-authenticated-user-email"));
}
