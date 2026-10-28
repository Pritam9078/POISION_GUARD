export class AppError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details }
}
export const badRequest = (msg, details) => new AppError(400, 'VALIDATION_ERROR', msg, details)
export const unauthorized = (msg = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', msg)
export const forbidden = (msg = 'You do not have permission for this action') => new AppError(403, 'FORBIDDEN', msg)
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`)
export const conflict = (msg, code = 'CONFLICT') => new AppError(409, code, msg)
export const unprocessable = (msg, code = 'UNPROCESSABLE') => new AppError(422, code, msg)
export const unavailable = (msg, code = 'PROVIDER_UNAVAILABLE') => new AppError(503, code, msg)
