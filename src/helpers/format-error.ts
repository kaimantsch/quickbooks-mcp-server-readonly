/**
 * Patterns that indicate sensitive information in error messages.
 * Each entry is [regex, replacement description].
 */
const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  // File paths (Unix-style)
  [/\/[\w\s./-]+\/[\w\s./-]+/g, '[path redacted]'],
  // Tokens and secrets (common patterns: long alphanumeric strings, RT1-xxx refresh tokens)
  [/\b(RT1-[\w-]+)/g, '[token redacted]'],
  [/\b(client_secret|client_id|access_token|refresh_token|bearer)\s*[:=]\s*\S+/gi, '$1=[redacted]'],
  // QuickBooks realm IDs (10+ digit numbers that look like realm IDs)
  [/\brealm\s+\d{10,}/gi, 'realm [redacted]'],
];

/**
 * Redact sensitive information from an error message string.
 */
function redact(message: string): string {
  let result = message;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Maps known error conditions to safe, user-facing messages.
 * Returns null if no known condition matches.
 */
function classifyError(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('etimedout')) {
    return 'Error: Could not connect to QuickBooks. Check your network connection and try again.';
  }
  if ((lower.includes('token') && lower.includes('expired')) || lower.includes('invalid_grant') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'Error: QuickBooks authentication expired. Re-run the auth server to refresh credentials.';
  }
  if (lower.includes('enoent') || lower.includes('no such file')) {
    return 'Error: A required configuration file is missing. Check the server setup.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'Error: QuickBooks rate limit reached. Wait a moment and try again.';
  }
  return null;
}

/**
 * Formats an error into a standardized, safe error message.
 * Redacts file paths, tokens, and credentials to prevent information leakage.
 */
export function formatError(error: unknown): string {
  let rawMessage: string;

  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else {
    // For unknown objects, extract only the status code and top-level message
    // rather than serializing the entire object
    const obj = error as Record<string, any>;
    const statusCode = obj?.statusCode || obj?.status || '';
    const message = obj?.message || obj?.body?.fault?.error?.[0]?.message || 'Unknown error';
    rawMessage = statusCode ? `${statusCode}: ${message}` : String(message);
  }

  // Try to classify into a safe, known error message first
  const classified = classifyError(rawMessage);
  if (classified) return classified;

  // Fall back to redacted version of the original message
  return `Error: ${redact(rawMessage)}`;
}
