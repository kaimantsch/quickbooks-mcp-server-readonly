# QuickBooks Online MCP Server (Read-Only Fork)

This is a **read-only** fork of [intuit/quickbooks-online-mcp-server](https://github.com/intuit/quickbooks-online-mcp-server). All create, update, and delete operations have been removed at the source level. This server can only query and retrieve QuickBooks data.

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

## Error Handling

If you see "QuickBooks not connected":

1. Check that your `.env` file contains all required variables
2. Verify that your tokens are valid and not expired
