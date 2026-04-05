/**
 * PII sanitization for QuickBooks entities.
 *
 * Strips sensitive fields at the lowest level so no code path --
 * MCP tools, direct client usage, or skill queries -- can leak PII.
 */

const CUSTOMER_PII_FIELDS = ['PrimaryAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate', 'BillAddr', 'ShipAddr'] as const;
const EMPLOYEE_PII_FIELDS = ['SSN', 'PrimaryAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate'] as const;
const VENDOR_PII_FIELDS   = ['PrimaryAddr', 'PrimaryPhone', 'Mobile', 'Fax', 'PrimaryEmailAddr', 'AcctNum'] as const;
const INVOICE_PII_FIELDS  = ['BillAddr', 'ShipAddr', 'BillEmail', 'RemitToAddr', 'ShipFromAddr'] as const;
const ESTIMATE_PII_FIELDS = ['BillAddr', 'ShipAddr', 'BillEmail', 'RemitToAddr', 'ShipFromAddr'] as const;
const BILL_PII_FIELDS     = ['VendorAddr', 'RemitToAddr', 'ShipAddr'] as const;

function stripFields<T extends Record<string, any>>(obj: T, fields: readonly string[]): Partial<T> {
  const copy = { ...obj };
  for (const field of fields) {
    delete copy[field];
  }
  return copy;
}

export function sanitizeCustomer(customer: Record<string, any>): Record<string, any> {
  return stripFields(customer, CUSTOMER_PII_FIELDS);
}

export function sanitizeEmployee(employee: Record<string, any>): Record<string, any> {
  return stripFields(employee, EMPLOYEE_PII_FIELDS);
}

export function sanitizeVendor(vendor: Record<string, any>): Record<string, any> {
  return stripFields(vendor, VENDOR_PII_FIELDS);
}

export function sanitizeInvoice(invoice: Record<string, any>): Record<string, any> {
  return stripFields(invoice, INVOICE_PII_FIELDS);
}

export function sanitizeEstimate(estimate: Record<string, any>): Record<string, any> {
  return stripFields(estimate, ESTIMATE_PII_FIELDS);
}

export function sanitizeBill(bill: Record<string, any>): Record<string, any> {
  return stripFields(bill, BILL_PII_FIELDS);
}

/**
 * Entity type -> sanitizer mapping, keyed by the QuickBooks method name patterns.
 */
const METHOD_SANITIZERS: Record<string, (obj: Record<string, any>) => Record<string, any>> = {
  Customer: sanitizeCustomer,
  Employee: sanitizeEmployee,
  Vendor: sanitizeVendor,
  Invoice: sanitizeInvoice,
  Estimate: sanitizeEstimate,
  Bill: sanitizeBill,
};

/**
 * Wraps a node-quickbooks callback so that results for Customer, Employee,
 * and Vendor entities are automatically sanitized before reaching the caller.
 *
 * For "get" methods the callback receives a single entity object.
 * For "find" methods it receives a QueryResponse wrapper with an array.
 */
export function wrapCallback(
  entityType: string,
  isSearch: boolean,
  originalCallback: (...args: any[]) => void,
): (...args: any[]) => void {
  const sanitizer = METHOD_SANITIZERS[entityType];
  if (!sanitizer) {
    return originalCallback;
  }

  return (err: any, result: any) => {
    if (err || !result) {
      return originalCallback(err, result);
    }

    if (isSearch) {
      const queryResponse = result?.QueryResponse;
      if (queryResponse?.[entityType] && Array.isArray(queryResponse[entityType])) {
        result = {
          ...result,
          QueryResponse: {
            ...queryResponse,
            [entityType]: queryResponse[entityType].map(sanitizer),
          },
        };
      }
    } else {
      result = sanitizer(result);
    }

    return originalCallback(err, result);
  };
}
