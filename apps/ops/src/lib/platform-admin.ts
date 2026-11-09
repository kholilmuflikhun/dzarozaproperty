export function isPlatformAdminEmail(email: string | null | undefined, configured = process.env.PLATFORM_ADMIN_EMAILS ?? "") {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return configured.split(",").some((candidate) => candidate.trim().toLowerCase() === normalizedEmail);
}
