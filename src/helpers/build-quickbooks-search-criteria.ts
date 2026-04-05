export interface QuickbooksFilter {
  /** Field/column name to filter on */
  field: string;
  /** Value to match against */
  value: any;
  /** Comparison operator to use (default '=') */
  operator?: string;
}

export interface AdvancedQuickbooksSearchOptions {
  /** Array of filter objects that map to QuickBooks query filters */
  filters?: QuickbooksFilter[];
  /** Sort ascending by the provided field */
  asc?: string;
  /** Sort descending by the provided field */
  desc?: string;
  /** Maximum number of rows to return */
  limit?: number;
  /** Number of rows to skip from the start of the result set */
  offset?: number;
  /** If true, only a count of rows is returned */
  count?: boolean;
  /** If true, transparently fetches all records. */
  fetchAll?: boolean;
}

/**
 * User-supplied criteria can be one of:
 *  1. A simple criteria object (e.g. { Name: 'Foo' })
 *  2. An array of objects specifying field/value/operator
 *  3. An {@link AdvancedQuickbooksSearchOptions} object that is translated to the array format expected by node-quickbooks
 */
export type QuickbooksSearchCriteriaInput =
  | Record<string, any>
  | Array<Record<string, any>>
  | AdvancedQuickbooksSearchOptions;

// ---------------------------------------------------------------------------
// Input sanitization
// ---------------------------------------------------------------------------

/** Operators that node-quickbooks supports in QQL WHERE clauses. */
const ALLOWED_OPERATORS = new Set(["=", "IN", "<", ">", "<=", ">=", "LIKE"]);

/** Meta-fields that node-quickbooks uses for pagination/sorting (not QQL column names). */
const META_FIELDS = new Set(["limit", "offset", "asc", "desc", "count", "fetchAll"]);

/**
 * A valid QQL field name is one or more segments of word characters joined by
 * dots (e.g. "DisplayName", "MetaData.CreateTime"). Anything else could be
 * used to break out of the WHERE clause.
 */
const SAFE_FIELD_RE = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$/;

const MAX_LIMIT = 1000;
const MAX_FILTERS = 50;

/**
 * Validate and sanitize a field name. Returns the field unchanged if it passes,
 * or throws with a descriptive message.
 */
export function validateFieldName(field: string): string {
  if (typeof field !== "string" || !SAFE_FIELD_RE.test(field)) {
    throw new Error(`Invalid field name: "${field}". Field names must be alphanumeric with optional dots.`);
  }
  return field;
}

/**
 * Validate an operator. Returns the operator if allowed, or throws.
 * Defaults to '=' when undefined.
 */
export function validateOperator(operator: string | undefined): string {
  if (operator === undefined || operator === null) return "=";
  if (!ALLOWED_OPERATORS.has(operator)) {
    throw new Error(`Invalid operator: "${operator}". Allowed: ${[...ALLOWED_OPERATORS].join(", ")}`);
  }
  return operator;
}

/**
 * Sanitize a single criterion entry from an array-form input.
 * Meta-fields (limit, offset, asc, desc, count, fetchAll) are passed through
 * with basic validation. Filter fields get full field name + operator checks.
 */
function sanitizeCriterion(entry: Record<string, any>): Record<string, any> {
  const field = entry.field;

  // Meta-field entries like { field: 'limit', value: 10 }
  if (META_FIELDS.has(field)) {
    if (field === "limit") {
      const v = typeof entry.value === "number" ? Math.max(1, Math.min(entry.value, MAX_LIMIT)) : MAX_LIMIT;
      return { field, value: v };
    }
    if (field === "offset") {
      const v = typeof entry.value === "number" ? Math.max(0, entry.value) : 0;
      return { field, value: v };
    }
    if (field === "asc" || field === "desc") {
      validateFieldName(String(entry.value));
      return { field, value: entry.value };
    }
    return { field, value: entry.value };
  }

  // Regular filter field
  validateFieldName(field);
  const operator = validateOperator(entry.operator);
  return { field, value: entry.value, operator };
}

/**
 * Sanitize a simple criteria object (key/value pairs like { DisplayName: 'Foo' }).
 * Keys become field names and must pass validation.
 */
function sanitizeSimpleCriteria(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    validateFieldName(key);
    result[key] = value;
  }
  return result;
}

/**
 * Convert various input shapes into the criteria shape that `node-quickbooks` expects.
 *
 * All inputs are validated:
 * - Field names must be alphanumeric (with optional dots)
 * - Operators must be in the allowlist
 * - Limit is clamped to 1-1000, offset to >= 0
 * - Maximum 50 filter entries per query
 *
 * Throws on invalid input rather than silently passing it through.
 */
export function buildQuickbooksSearchCriteria(
  input: QuickbooksSearchCriteriaInput
): Record<string, any> | Array<Record<string, any>> {
  // Array form: validate each entry
  if (Array.isArray(input)) {
    if (input.length > MAX_FILTERS) {
      throw new Error(`Too many filter criteria (${input.length}). Maximum is ${MAX_FILTERS}.`);
    }
    return input.map(sanitizeCriterion);
  }

  // Check if this is an advanced options object
  const possibleAdvancedKeys: (keyof AdvancedQuickbooksSearchOptions)[] = [
    "filters",
    "asc",
    "desc",
    "limit",
    "offset",
    "count",
    "fetchAll",
  ];

  const inputKeys = Object.keys(input || {});
  const isAdvanced = inputKeys.some((k) =>
    possibleAdvancedKeys.includes(k as keyof AdvancedQuickbooksSearchOptions)
  );

  if (!isAdvanced) {
    // Simple criteria object -- validate keys as field names
    return sanitizeSimpleCriteria(input as Record<string, any>);
  }

  // Advanced options object
  const options = input as AdvancedQuickbooksSearchOptions;
  const criteriaArr: Array<Record<string, any>> = [];

  // Validate and convert filters
  if (options.filters) {
    if (options.filters.length > MAX_FILTERS) {
      throw new Error(`Too many filters (${options.filters.length}). Maximum is ${MAX_FILTERS}.`);
    }
    options.filters.forEach((f) => {
      validateFieldName(f.field);
      const operator = validateOperator(f.operator);
      criteriaArr.push({ field: f.field, value: f.value, operator });
    });
  }

  // Sorting -- validate sort field names
  if (options.asc) {
    validateFieldName(options.asc);
    criteriaArr.push({ field: "asc", value: options.asc });
  }
  if (options.desc) {
    validateFieldName(options.desc);
    criteriaArr.push({ field: "desc", value: options.desc });
  }

  // Pagination -- clamp values
  if (typeof options.limit === "number") {
    criteriaArr.push({ field: "limit", value: Math.max(1, Math.min(options.limit, MAX_LIMIT)) });
  }
  if (typeof options.offset === "number") {
    criteriaArr.push({ field: "offset", value: Math.max(0, options.offset) });
  }
  if (options.count) {
    criteriaArr.push({ field: "count", value: true });
  }
  if (options.fetchAll) {
    criteriaArr.push({ field: "fetchAll", value: true });
  }

  // If nothing ended up in the array, return empty object so Quickbooks returns all items.
  return criteriaArr.length > 0 ? criteriaArr : {};
}
