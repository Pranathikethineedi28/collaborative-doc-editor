export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "bad_request");
export const unauthorized = (msg = "Please sign in") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have permission to do that") => new HttpError(403, msg, "forbidden");
// We return 404 (not 403) for documents a user cannot see, so IDs don't leak existence.
export const notFound = (msg = "Document not found") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string) => new HttpError(409, msg, "conflict");
