export interface NormalizedError {
  error: string;          // human friendly
  code: string;           // stable machine code
  status?: number;        // associated HTTP status if known
  details?: any;          // raw detail (sanitized)
}

// Heuristics for GitHub / network errors
export function normalizeError(err: any, fallback: { error: string; code: string; status?: number } = { error: 'Internal error', code: 'internal_error', status: 500 }): NormalizedError {
  if (!err) return { ...fallback };
  const status = err.status || err.response?.status || fallback.status;
  const msg = err.message || err.response?.data?.message || fallback.error;
  const ghDoc = err.response?.data?.documentation_url || err.documentation_url;
  // Classify
  let code = fallback.code;
  if (status === 404) code = 'not_found';
  else if (status === 401 || status === 403) {
    if (ghDoc && /saml-single-sign-on/i.test(ghDoc)) code = 'saml_required';
    else code = 'forbidden';
  } else if (status === 422) code = 'validation_failed';
  else if (status === 429 || status === 403 && /rate limit/i.test(msg)) code = 'rate_limited';
  else if (status && status >= 500) code = 'upstream_error';

  return { error: msg, code, status, details: ghDoc ? { documentationUrl: ghDoc } : undefined };
}

/** Helper to send JSON error (non-destructive: keeps legacy `error` field) */
export function sendNormalized(res: any, norm: NormalizedError) {
  const { status = 500, ...rest } = norm;
  return res.status(status).json(rest);
}
