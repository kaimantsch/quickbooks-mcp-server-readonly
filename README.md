# QuickBooks Online MCP Server (Read-Only Fork)

This is a **read-only** fork of [intuit/quickbooks-online-mcp-server](https://github.com/intuit/quickbooks-online-mcp-server). All create, update, and delete operations have been removed at the source level. This server can only query and retrieve QuickBooks data.

In addition to being read-only, this server strips sensitive personally identifiable information (PII) from all responses at the client layer -- regardless of whether data is accessed via MCP tools, direct client calls, or skill queries.

## Why?

QuickBooks Online's OAuth scopes don't offer a read-only option. The `com.intuit.quickbooks.accounting` scope grants full read/write access. This fork enforces read-only access at the application layer by removing all write tools from the MCP server, so an LLM connected via MCP literally has no write operations available to call.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=production
```

3. Get your Client ID and Client Secret:
   - Go to the [Intuit Developer Portal](https://developer.intuit.com/)
   - Create a new app or select an existing one
   - Get the Client ID and Client Secret from the app's keys section
   - Add `http://localhost:8000/callback` to the app's Redirect URIs

## Authentication

### Option 1: Using Environment Variables

If you already have a refresh token and realm ID, add them to your `.env` file:

```env
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_realm_id
```

### Option 2: Using the OAuth Flow

If you don't have a refresh token, use the built-in OAuth flow:

1. Make sure your `.env` file has `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET` set (see Setup above).

2. Build the project if you haven't already:
```bash
npm run build
```

3. Run the auth server:
```bash
node dist/auth-server.js
```

4. A browser window will open and prompt you to sign in to your Intuit/QuickBooks account and authorize the app.

5. After authorizing, the callback saves your `QUICKBOOKS_REFRESH_TOKEN` and `QUICKBOOKS_REALM_ID` to the `.env` file automatically.

**Note:** QuickBooks uses rotating refresh tokens. Each time the server refreshes its access token, a new refresh token is issued and the previous one is invalidated. The server handles this automatically by saving updated tokens to `.env` after each refresh.

## Connection Errors

If you see "QuickBooks not connected":

1. Check that your `.env` file contains all required variables
2. Verify that your tokens are valid and not expired

## Available Tools (Read-Only)

All tools are **read-only**. No tool in this server can create, modify, or delete any QuickBooks data.

| Entity | Tools |
|--------|-------|
| Account | `search_accounts` |
| Bill | `get_bill`, `search_bills` |
| Bill Payment | `get_bill_payment`, `search_bill_payments` |
| Customer | `get_customer`, `search_customers` |
| Employee | `get_employee`, `search_employees` |
| Estimate | `get_estimate`, `search_estimates` |
| Invoice | `read_invoice`, `search_invoices` |
| Item | `read_item`, `search_items` |
| Journal Entry | `get_journal_entry`, `search_journal_entries` |
| Purchase | `get_purchase`, `search_purchases` |
| Vendor | `get_vendor`, `search_vendors` |

**Total: 21 read-only tools** (down from 50+ in the upstream repo).

## What Was Removed

All `create_*`, `update_*`, and `delete_*` tools and their handler implementations were deleted from source. This is not a runtime toggle; the code to perform writes does not exist in this fork.

## Security

This server implements defense in depth across four layers: write-method blocking, query injection prevention, PII filtering, and error redaction.

### 1. Write-method blocking (client proxy)

QuickBooks Online's OAuth scope (`com.intuit.quickbooks.accounting`) grants full read/write access -- there is no read-only scope available. This fork enforces read-only at multiple levels:

- **MCP tool layer:** All write tools removed from source (not disabled at runtime).
- **Client proxy layer:** The `node-quickbooks` SDK instance is wrapped in a Proxy (`src/clients/quickbooks-client.ts`) that maintains an **allowlist** of 21 read-only methods (`find*` and `get*`). Any call to a method not on the list -- including all 84 write methods like `createInvoice`, `updateCustomer`, `deletePayment`, `voidInvoice`, `sendInvoicePdf`, `batch`, `upload`, etc. -- throws an error. This prevents writes even if a bug, dependency, or future code change attempts to call the underlying SDK directly.

### 2. Query injection prevention

All search queries flow through `buildQuickbooksSearchCriteria()` (`src/helpers/build-quickbooks-search-criteria.ts`), which validates all user-supplied input before it reaches the `node-quickbooks` SDK:

- **Field name validation:** Field names must match `^[A-Za-z_]\w*(\.[A-Za-z_]\w*)*$` (alphanumeric with optional dots for nested fields like `MetaData.CreateTime`). Injection attempts like `DisplayName' OR 1=1 --` are rejected.
- **Operator allowlist:** Only `=`, `IN`, `<`, `>`, `<=`, `>=`, `LIKE` are permitted. Malicious operators are rejected.
- **Limit/offset clamping:** `limit` is clamped to 1-1000, `offset` to >= 0. No unbounded queries.
- **Filter count cap:** Maximum 50 filter entries per query.
- **Sort field validation:** Sort field names (`asc`/`desc`) are validated with the same field name rules.

This matters because `node-quickbooks` concatenates field names and operators directly into QQL query strings without sanitization. Only values receive basic escaping.

### 3. PII filtering

PII is stripped from Customer, Employee, and Vendor responses at the **client proxy layer**, before data reaches any handler or MCP tool. The sanitization logic lives in `src/helpers/sanitize-pii.ts`.

**Customer** (`getCustomer`, `findCustomers`) -- stripped fields:
- `PrimaryAddr`, `BillAddr`, `ShipAddr`, `PrimaryPhone`, `Mobile`, `PrimaryEmailAddr`, `BirthDate`

**Employee** (`getEmployee`, `findEmployees`) -- stripped fields:
- `SSN`, `PrimaryAddr`, `PrimaryPhone`, `Mobile`, `PrimaryEmailAddr`, `BirthDate`

**Vendor** (`getVendor`, `findVendors`) -- stripped fields:
- `PrimaryAddr`, `PrimaryPhone`, `Mobile`, `Fax`, `PrimaryEmailAddr`, `AcctNum`

**Invoice** (`getInvoice`, `findInvoices`) -- stripped fields:
- `BillAddr`, `ShipAddr`, `BillEmail`, `RemitToAddr`, `ShipFromAddr`

**Estimate** (`getEstimate`, `findEstimates`) -- stripped fields:
- `BillAddr`, `ShipAddr`, `BillEmail`, `RemitToAddr`, `ShipFromAddr`

**Bill** (`getBill`, `findBills`) -- stripped fields:
- `VendorAddr`, `RemitToAddr`, `ShipAddr`

These fields are removed before data leaves the client, so no code path can leak PII.

### 4. Error redaction

Error messages are sanitized before being returned in tool responses (`src/helpers/format-error.ts`):

- **Classification:** Known error types (connection failures, auth expiry, missing config, rate limits) are mapped to safe, fixed messages with no internal details.
- **Redaction:** Unclassified errors have sensitive patterns stripped: file paths, refresh tokens (`RT1-*`), credential values (`client_secret=...`), and realm IDs.
- **Structured extraction:** Unknown error objects (e.g., from the QuickBooks API) have only their status code and top-level message extracted, rather than being fully serialized with headers and token details.

### Known limitations

- **OAuth scope:** The underlying OAuth token still has full read/write permissions. The write block is enforced at the application layer only. If the token itself were extracted and used outside this server, write operations would be possible.
- **CSRF state:** The OAuth flow uses a hardcoded state parameter (`'testState'`), which does not protect against CSRF during re-authentication. This is low-risk since auth is a local, manual process.

## Testing

Tests live in the `test/` directory and use [Vitest](https://vitest.dev/).

Run the full suite:
```bash
npm test
```

Run in watch mode (re-runs on file changes):
```bash
npm run test:watch
```

### Test coverage

**`test/sanitize-pii.test.ts`** -- PII filtering (49 tests):
- Unit tests for `sanitizeCustomer`, `sanitizeEmployee`, `sanitizeVendor`, `sanitizeInvoice`, `sanitizeEstimate`, `sanitizeBill`
- Callback wrapping for single-entity and search methods across all entity types
- Proxy integration tests for end-to-end PII filtering

**`test/security.test.ts`** -- Security hardening (53 tests):
- Field name validation (rejects injection, accepts valid names)
- Operator allowlisting
- QQL injection prevention (malicious fields, operators, array input)
- Limit/offset clamping
- Error redaction (classification, path/token/credential stripping)
- Write-method blocking (create, update, delete, void, send, batch, upload)
- PII proxy bypass attempts
- Read method passthrough verification

**`test/integration.test.ts`** -- Live API smoke tests (3 tests):
- Requires QuickBooks credentials; verifies end-to-end connectivity

No QuickBooks credentials or network access needed for unit and security tests -- all use mock data.
