/**
 * Minimal shapes of an HTTP request/response. Express, Fastify (raw) and
 * plain `node:http` objects all satisfy them, so core stays framework-agnostic.
 */
export type HeaderValue = string | string[] | number | undefined;

export interface HttpRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  headers?: Record<string, HeaderValue>;
  socket?: { remoteAddress?: string } | null;
}

export interface HttpResponseLike {
  statusCode?: number;
  getHeader?(name: string): HeaderValue;
}
