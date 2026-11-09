export class UnauthorizedError extends Error {
  constructor() { super("Autentikasi diperlukan."); this.name = "UnauthorizedError"; }
}
export class ForbiddenError extends Error {
  constructor() { super("Akses ke organisasi atau tindakan ini tidak diizinkan."); this.name = "ForbiddenError"; }
}
