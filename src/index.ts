#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { QuickbooksMCPServer } from "./server/qbo-mcp-server.js";
import { RegisterTool } from "./helpers/register-tool.js";

// READ-ONLY FORK: All create, update, and delete tools have been removed.
// This server can only query and retrieve QuickBooks data.

// Invoice tools (read-only)
import { ReadInvoiceTool } from "./tools/read-invoice.tool.js";
import { SearchInvoicesTool } from "./tools/search-invoices.tool.js";

// Account tools (read-only)
import { SearchAccountsTool } from "./tools/search-accounts.tool.js";

// Item tools (read-only)
import { ReadItemTool } from "./tools/read-item.tool.js";
import { SearchItemsTool } from "./tools/search-items.tool.js";

// Customer tools (read-only)
import { GetCustomerTool } from "./tools/get-customer.tool.js";
import { SearchCustomersTool } from "./tools/search-customers.tool.js";

// Estimate tools (read-only)
import { GetEstimateTool } from "./tools/get-estimate.tool.js";
import { SearchEstimatesTool } from "./tools/search-estimates.tool.js";

// Bill tools (read-only)
import { GetBillTool } from "./tools/get-bill.tool.js";
import { SearchBillsTool } from "./tools/search-bills.tool.js";

// Vendor tools (read-only)
import { GetVendorTool } from "./tools/get-vendor.tool.js";
import { SearchVendorsTool } from "./tools/search-vendors.tool.js";

// Employee tools (read-only)
import { GetEmployeeTool } from "./tools/get-employee.tool.js";
import { SearchEmployeesTool } from "./tools/search-employees.tool.js";

// Journal Entry tools (read-only)
import { GetJournalEntryTool } from "./tools/get-journal-entry.tool.js";
import { SearchJournalEntriesTool } from "./tools/search-journal-entries.tool.js";

// Bill Payment tools (read-only)
import { GetBillPaymentTool } from "./tools/get-bill-payment.tool.js";
import { SearchBillPaymentsTool } from "./tools/search-bill-payments.tool.js";

// Purchase tools (read-only)
import { GetPurchaseTool } from "./tools/get-purchase.tool.js";
import { SearchPurchasesTool } from "./tools/search-purchases.tool.js";

const main = async () => {
  const server = QuickbooksMCPServer.GetServer();

  // Invoices
  RegisterTool(server, ReadInvoiceTool);
  RegisterTool(server, SearchInvoicesTool);

  // Chart of accounts
  RegisterTool(server, SearchAccountsTool);

  // Items
  RegisterTool(server, ReadItemTool);
  RegisterTool(server, SearchItemsTool);

  // Customers
  RegisterTool(server, GetCustomerTool);
  RegisterTool(server, SearchCustomersTool);

  // Estimates
  RegisterTool(server, GetEstimateTool);
  RegisterTool(server, SearchEstimatesTool);

  // Bills
  RegisterTool(server, GetBillTool);
  RegisterTool(server, SearchBillsTool);

  // Vendors
  RegisterTool(server, GetVendorTool);
  RegisterTool(server, SearchVendorsTool);

  // Employees
  RegisterTool(server, GetEmployeeTool);
  RegisterTool(server, SearchEmployeesTool);

  // Journal entries
  RegisterTool(server, GetJournalEntryTool);
  RegisterTool(server, SearchJournalEntriesTool);

  // Bill payments
  RegisterTool(server, GetBillPaymentTool);
  RegisterTool(server, SearchBillPaymentsTool);

  // Purchases
  RegisterTool(server, GetPurchaseTool);
  RegisterTool(server, SearchPurchasesTool);

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
