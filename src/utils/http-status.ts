export enum HttpStatus {
  OK                  = 200,
  Created             = 201,
  Accepted            = 202,
  NoContent           = 204,
  BadRequest          = 400,
  Unauthorized        = 401,
  Forbidden           = 403,
  NotFound            = 404,
  MethodNotAllowed    = 405,
  Conflict            = 409,
  UnprocessableEntity = 422,
  TooManyRequests     = 429,
  InternalServerError = 500,
  BadGateway          = 502,
  ServiceUnavailable  = 503,
}

export function resolveStatus(label: string): number {
  const code = HttpStatus[label as keyof typeof HttpStatus];
  if (code === undefined) {
    throw new Error(
      `Unknown HTTP status label "${label}". Valid labels: ${Object.keys(HttpStatus).join(', ')}`,
    );
  }
  return code;
}
