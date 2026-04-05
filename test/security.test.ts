import { describe, it, expect } from 'vitest';
import { buildQuickbooksSearchCriteria, validateFieldName, validateOperator } from '../src/helpers/build-quickbooks-search-criteria.js';
import { formatError } from '../src/helpers/format-error.js';
import { sanitizeCustomer, sanitizeEmployee, sanitizeVendor, sanitizeInvoice, sanitizeEstimate, sanitizeBill, wrapCallback } from '../src/helpers/sanitize-pii.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCustomer(overrides: Record<string, any> = {}) {
  return {
    Id: '1',
    DisplayName: "Amy's Bird Sanctuary",
    CompanyName: "Amy's Bird Sanctuary",
    GivenName: 'Amy',
    FamilyName: 'Lauterbach',
    Balance: 239,
    Active: true,
    PrimaryAddr: { Line1: '4581 Finch St.', City: 'Bayshore' },
    BillAddr: { Line1: '4581 Finch St.', City: 'Bayshore' },
    ShipAddr: { Line1: '4581 Finch St.', City: 'Bayshore' },
    PrimaryPhone: { FreeFormNumber: '(650) 555-3311' },
    Mobile: { FreeFormNumber: '(650) 555-1234' },
    PrimaryEmailAddr: { Address: 'birds@intuit.com' },
    BirthDate: '1980-01-15',
    ...overrides,
  };
}

function makeEmployee(overrides: Record<string, any> = {}) {
  return {
    Id: '1',
    DisplayName: 'John Smith',
    GivenName: 'John',
    FamilyName: 'Smith',
    Active: true,
    SSN: 'XXX-XX-1234',
    PrimaryAddr: { Line1: '123 Main St' },
    PrimaryPhone: { FreeFormNumber: '(555) 123-4567' },
    Mobile: { FreeFormNumber: '(555) 987-6543' },
    PrimaryEmailAddr: { Address: 'john@example.com' },
    BirthDate: '1990-06-15',
    ...overrides,
  };
}

function makeVendor(overrides: Record<string, any> = {}) {
  return {
    Id: '1',
    DisplayName: 'Acme Supplies',
    CompanyName: 'Acme Supplies',
    Balance: 500,
    Active: true,
    PrimaryAddr: { Line1: '789 Oak Ave' },
    PrimaryPhone: { FreeFormNumber: '(555) 111-2222' },
    Mobile: { FreeFormNumber: '(555) 333-4444' },
    Fax: { FreeFormNumber: '(555) 555-6666' },
    PrimaryEmailAddr: { Address: 'acme@example.com' },
    AcctNum: '9876543210',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Field name validation
// ---------------------------------------------------------------------------

describe('validateFieldName', () => {
  it('accepts simple field names', () => {
    expect(validateFieldName('DisplayName')).toBe('DisplayName');
    expect(validateFieldName('Id')).toBe('Id');
    expect(validateFieldName('Balance')).toBe('Balance');
  });

  it('accepts dotted field names', () => {
    expect(validateFieldName('MetaData.CreateTime')).toBe('MetaData.CreateTime');
    expect(validateFieldName('MetaData.LastUpdatedTime')).toBe('MetaData.LastUpdatedTime');
  });

  it('accepts fields starting with underscore', () => {
    expect(validateFieldName('_custom')).toBe('_custom');
  });

  it('rejects SQL injection in field names', () => {
    expect(() => validateFieldName("DisplayName' --")).toThrow('Invalid field name');
    expect(() => validateFieldName("Id' or '1'='1")).toThrow('Invalid field name');
    expect(() => validateFieldName("'; DROP TABLE")).toThrow('Invalid field name');
  });

  it('rejects fields with spaces', () => {
    expect(() => validateFieldName('Display Name')).toThrow('Invalid field name');
  });

  it('rejects empty string', () => {
    expect(() => validateFieldName('')).toThrow('Invalid field name');
  });

  it('rejects fields starting with a dot', () => {
    expect(() => validateFieldName('.CreateTime')).toThrow('Invalid field name');
  });

  it('rejects fields starting with a number', () => {
    expect(() => validateFieldName('1Field')).toThrow('Invalid field name');
  });
});

// ---------------------------------------------------------------------------
// Operator validation
// ---------------------------------------------------------------------------

describe('validateOperator', () => {
  it('accepts all allowed operators', () => {
    for (const op of ['=', 'IN', '<', '>', '<=', '>=', 'LIKE']) {
      expect(validateOperator(op)).toBe(op);
    }
  });

  it('defaults to = when undefined', () => {
    expect(validateOperator(undefined)).toBe('=');
  });

  it('rejects injection in operators', () => {
    expect(() => validateOperator(">' OR '1'='1")).toThrow('Invalid operator');
    expect(() => validateOperator('; --')).toThrow('Invalid operator');
    expect(() => validateOperator('!=')).toThrow('Invalid operator');
  });
});

// ---------------------------------------------------------------------------
// QQL injection -- buildQuickbooksSearchCriteria now rejects bad input
// ---------------------------------------------------------------------------

describe('QQL injection prevention via buildQuickbooksSearchCriteria', () => {
  it('rejects SQL injection in filter values (advanced form)', () => {
    const maliciousInput = {
      filters: [
        { field: "DisplayName' OR 1=1 --", value: "test", operator: "=" },
      ],
    };
    expect(() => buildQuickbooksSearchCriteria(maliciousInput)).toThrow('Invalid field name');
  });

  it('rejects injection in field names (array form)', () => {
    const rawArray = [
      { field: "DisplayName' --", value: "test", operator: "=" },
    ];
    expect(() => buildQuickbooksSearchCriteria(rawArray)).toThrow('Invalid field name');
  });

  it('rejects DROP TABLE in array form', () => {
    const rawArray = [
      { field: 'DROP TABLE', value: '1', operator: '=' },
    ];
    expect(() => buildQuickbooksSearchCriteria(rawArray)).toThrow('Invalid field name');
  });

  it('rejects injection in simple object keys', () => {
    const simpleObj = { "'; DROP TABLE Invoices; --": 'value' };
    expect(() => buildQuickbooksSearchCriteria(simpleObj)).toThrow('Invalid field name');
  });

  it('rejects malicious operators', () => {
    const maliciousInput = {
      filters: [
        { field: 'Balance', value: '0', operator: ">' OR '1'='1" },
      ],
    };
    expect(() => buildQuickbooksSearchCriteria(maliciousInput)).toThrow('Invalid operator');
  });

  it('rejects more than 50 filters', () => {
    const manyFilters = {
      filters: Array.from({ length: 51 }, (_, i) => ({
        field: `Field${i}`,
        value: `val${i}`,
        operator: '=' as const,
      })),
    };
    expect(() => buildQuickbooksSearchCriteria(manyFilters)).toThrow('Too many filters');
  });

  it('rejects more than 50 entries in array form', () => {
    const rawArray = Array.from({ length: 51 }, (_, i) => ({
      field: `Field${i}`,
      value: `val${i}`,
      operator: '=',
    }));
    expect(() => buildQuickbooksSearchCriteria(rawArray)).toThrow('Too many filter criteria');
  });

  it('allows valid criteria through', () => {
    const validInput = {
      filters: [
        { field: 'DisplayName', value: 'Amy', operator: 'LIKE' },
        { field: 'Balance', value: 0, operator: '>' },
      ],
      desc: 'Balance',
      limit: 10,
    };
    const result = buildQuickbooksSearchCriteria(validInput) as Array<Record<string, any>>;
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(4); // 2 filters + desc + limit
  });

  it('allows valid array criteria through', () => {
    const validArray = [
      { field: 'TxnDate', value: '2026-01-01', operator: '>' },
      { field: 'desc', value: 'TxnDate' },
      { field: 'limit', value: 10 },
    ];
    const result = buildQuickbooksSearchCriteria(validArray) as Array<Record<string, any>>;
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ field: 'TxnDate', value: '2026-01-01', operator: '>' });
  });

  it('allows valid simple object criteria through', () => {
    const simpleObj = { DisplayName: 'Amy', Active: true };
    const result = buildQuickbooksSearchCriteria(simpleObj) as Record<string, any>;
    expect(result).toEqual({ DisplayName: 'Amy', Active: true });
  });
});

// ---------------------------------------------------------------------------
// Limit and offset clamping
// ---------------------------------------------------------------------------

describe('Limit and offset clamping', () => {
  it('clamps negative limit to 1', () => {
    const input = { limit: -1 };
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result).toContainEqual({ field: 'limit', value: 1 });
  });

  it('clamps limit above 1000 to 1000', () => {
    const input = { limit: 5000 };
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result).toContainEqual({ field: 'limit', value: 1000 });
  });

  it('clamps negative offset to 0', () => {
    const input = { offset: -100 };
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result).toContainEqual({ field: 'offset', value: 0 });
  });

  it('clamps negative limit in array form', () => {
    const input = [{ field: 'limit', value: -1 }];
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result[0]).toEqual({ field: 'limit', value: 1 });
  });

  it('clamps negative offset in array form', () => {
    const input = [{ field: 'offset', value: -50 }];
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result[0]).toEqual({ field: 'offset', value: 0 });
  });

  it('validates sort field names in array form', () => {
    const input = [{ field: 'asc', value: "TxnDate' --" }];
    expect(() => buildQuickbooksSearchCriteria(input)).toThrow('Invalid field name');
  });

  it('allows valid sort field in array form', () => {
    const input = [{ field: 'desc', value: 'TxnDate' }];
    const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;
    expect(result[0]).toEqual({ field: 'desc', value: 'TxnDate' });
  });
});

// ---------------------------------------------------------------------------
// Error information redaction -- formatError
// ---------------------------------------------------------------------------

describe('Error information redaction via formatError', () => {
  it('classifies connection errors into a safe message', () => {
    const error = new Error('Connection to quickbooks-mcp-server at /Users/kai/.env failed: ECONNREFUSED');
    const result = formatError(error);
    expect(result).not.toContain('/Users/kai/.env');
    expect(result).toContain('Could not connect to QuickBooks');
  });

  it('classifies auth errors into a safe message', () => {
    const error = 'OAuth token abc123xyz expired for realm 9341456691291550';
    const result = formatError(error);
    expect(result).not.toContain('abc123xyz');
    expect(result).not.toContain('9341456691291550');
    expect(result).toContain('authentication expired');
  });

  it('extracts only status code and message from unknown error objects', () => {
    const error = {
      statusCode: 401,
      body: { fault: { error: [{ message: 'Token expired', detail: 'RefreshToken=RT1-xxx' }] } },
      headers: { 'x-request-id': 'abc-123' },
    };
    const result = formatError(error);
    expect(result).not.toContain('RefreshToken=RT1-xxx');
    expect(result).not.toContain('abc-123');
    // 401 triggers auth classification
    expect(result).toContain('authentication expired');
  });

  it('classifies missing file errors into a safe message', () => {
    const error = new Error('ENOENT: no such file or directory, open \'/Users/kai/AI ACCESS AREA/ai-executive-assistant/mcp-servers/quickbooks-mcp-server/.env\'');
    const result = formatError(error);
    expect(result).not.toContain('/Users/kai/AI ACCESS AREA');
    expect(result).toContain('configuration file is missing');
  });

  it('redacts credentials from unclassified error messages', () => {
    const error = new Error('Invalid client_secret: LZRCXF5OsSGs2DEbQG7VhfMGHGoijXiTjp3jiGAl');
    const result = formatError(error);
    expect(result).not.toContain('LZRCXF5OsSGs2DEbQG7VhfMGHGoijXiTjp3jiGAl');
    expect(result).toContain('client_secret=[redacted]');
  });

  it('redacts file paths from unclassified error messages', () => {
    const error = new Error('Failed to read /Users/kai/documents/config.json');
    const result = formatError(error);
    expect(result).not.toContain('/Users/kai/documents/config.json');
    expect(result).toContain('[path redacted]');
  });

  it('redacts refresh tokens from unclassified error messages', () => {
    const error = new Error('Token rotation failed for RT1-114-H0-1784137629urcxw80rq38zh3zy4lc2');
    const result = formatError(error);
    expect(result).not.toContain('RT1-114-H0-1784137629urcxw80rq38zh3zy4lc2');
    expect(result).toContain('[token redacted]');
  });

  it('classifies rate limit errors', () => {
    const error = new Error('429 Too Many Requests: rate limit exceeded');
    const result = formatError(error);
    expect(result).toContain('rate limit reached');
  });

  it('passes through safe, generic error messages unchanged', () => {
    const error = new Error('Invalid query: field Balance does not exist');
    const result = formatError(error);
    expect(result).toBe('Error: Invalid query: field Balance does not exist');
  });

  it('extracts nested fault message from QB error objects', () => {
    const error = {
      statusCode: 400,
      body: { fault: { error: [{ message: 'Invalid query', detail: 'some detail' }] } },
    };
    const result = formatError(error);
    expect(result).toContain('Invalid query');
    expect(result).not.toContain('some detail');
  });
});

// ---------------------------------------------------------------------------
// PII sanitization completeness
// ---------------------------------------------------------------------------

describe('PII sanitization completeness', () => {
  const CUSTOMER_PII = ['PrimaryAddr', 'BillAddr', 'ShipAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate'];

  it('strips PII even when fields contain nested sensitive data', () => {
    const customer = makeCustomer({
      PrimaryAddr: {
        Line1: '4581 Finch St.',
        City: 'Bayshore',
        CountrySubDivisionCode: 'CA',
        PostalCode: '94326',
        Lat: '37.123',
        Long: '-122.456',
      },
    });
    const result = sanitizeCustomer(customer);
    expect(result).not.toHaveProperty('PrimaryAddr');
  });

  it('strips SSN from employee even when non-masked', () => {
    const employee = makeEmployee({ SSN: '123-45-6789' });
    const result = sanitizeEmployee(employee);
    expect(result).not.toHaveProperty('SSN');
  });

  it('strips AcctNum from vendor regardless of format', () => {
    const vendor = makeVendor({ AcctNum: 'BANK-ROUTING-021000021' });
    const result = sanitizeVendor(vendor);
    expect(result).not.toHaveProperty('AcctNum');
  });

  it('strips BillAddr, ShipAddr, and BillEmail from invoices', () => {
    const invoice = {
      Id: '1',
      TotalAmt: 500,
      CustomerRef: { value: '1', name: "Amy's Bird Sanctuary" },
      BillAddr: { Id: '95', Line1: 'Russ Sonnenschein', Line3: '5647 Cypress Hill Ave.', Lat: '37.42' },
      ShipAddr: { Line1: '5647 Cypress Hill Ave.', City: 'Middlefield', PostalCode: '94303' },
      BillEmail: { Address: 'birds@intuit.com' },
      RemitToAddr: { Line1: '123 Remit St.' },
    };
    const result = sanitizeInvoice(invoice);
    expect(result).not.toHaveProperty('BillAddr');
    expect(result).not.toHaveProperty('ShipAddr');
    expect(result).not.toHaveProperty('BillEmail');
    expect(result).not.toHaveProperty('RemitToAddr');
    expect(result).toHaveProperty('Id', '1');
    expect(result).toHaveProperty('TotalAmt', 500);
    expect(result).toHaveProperty('CustomerRef');
  });

  it('strips BillAddr, ShipAddr, and BillEmail from estimates', () => {
    const estimate = {
      Id: '100',
      TotalAmt: 335.25,
      CustomerRef: { value: '24', name: 'Sonnenschein Family Store' },
      BillAddr: { Line1: '5647 Cypress Hill Ave.' },
      ShipAddr: { Line1: '5647 Cypress Hill Ave.' },
      BillEmail: { Address: 'store@example.com' },
    };
    const result = sanitizeEstimate(estimate);
    expect(result).not.toHaveProperty('BillAddr');
    expect(result).not.toHaveProperty('ShipAddr');
    expect(result).not.toHaveProperty('BillEmail');
    expect(result).toHaveProperty('Id', '100');
    expect(result).toHaveProperty('TotalAmt', 335.25);
  });

  it('strips VendorAddr and RemitToAddr from bills', () => {
    const bill = {
      Id: '50',
      TotalAmt: 200,
      VendorRef: { value: '56', name: "Bob's Burger Joint" },
      VendorAddr: { Line1: '123 Vendor St.', City: 'Somewhere' },
      RemitToAddr: { Line1: '456 Remit Ln.' },
    };
    const result = sanitizeBill(bill);
    expect(result).not.toHaveProperty('VendorAddr');
    expect(result).not.toHaveProperty('RemitToAddr');
    expect(result).toHaveProperty('Id', '50');
    expect(result).toHaveProperty('VendorRef');
  });

  it('does not mutate original invoice object', () => {
    const original = {
      Id: '1',
      BillAddr: { Line1: '123 Main St.' },
      BillEmail: { Address: 'test@example.com' },
    };
    sanitizeInvoice(original);
    expect(original).toHaveProperty('BillAddr');
    expect(original).toHaveProperty('BillEmail');
  });

  it('sanitizes all entities in a batch search response', () => {
    const response = {
      QueryResponse: {
        Customer: Array.from({ length: 50 }, (_, i) => makeCustomer({ Id: String(i) })),
        totalCount: 50,
      },
    };

    const wrapped = wrapCallback('Customer', true, (err, result) => {
      const customers = result.QueryResponse.Customer;
      expect(customers).toHaveLength(50);
      for (const c of customers) {
        for (const field of CUSTOMER_PII) {
          expect(c).not.toHaveProperty(field);
        }
        expect(c).toHaveProperty('DisplayName');
        expect(c).toHaveProperty('Balance');
      }
    });
    wrapped(null, response);
  });
});

// ---------------------------------------------------------------------------
// Read-only proxy: write method blocking + PII filtering
// ---------------------------------------------------------------------------

describe('Read-only proxy', () => {
  const ALLOWED_METHODS = new Set([
    'findAccounts', 'findBillPayments', 'findBills', 'findCustomers',
    'findEmployees', 'findEstimates', 'findInvoices', 'findItems',
    'findJournalEntries', 'findPurchases', 'findVendors',
    'getAccount', 'getBill', 'getBillPayment', 'getCustomer',
    'getEmployee', 'getEstimate', 'getInvoice', 'getItem',
    'getJournalEntry', 'getPurchase', 'getVendor',
  ]);

  const PII_MAP: Record<string, { entity: string; isSearch: boolean }> = {
    getCustomer: { entity: 'Customer', isSearch: false },
    findCustomers: { entity: 'Customer', isSearch: true },
    getEmployee: { entity: 'Employee', isSearch: false },
    findEmployees: { entity: 'Employee', isSearch: true },
    getVendor: { entity: 'Vendor', isSearch: false },
    findVendors: { entity: 'Vendor', isSearch: true },
    getInvoice: { entity: 'Invoice', isSearch: false },
    findInvoices: { entity: 'Invoice', isSearch: true },
    getEstimate: { entity: 'Estimate', isSearch: false },
    findEstimates: { entity: 'Estimate', isSearch: true },
    getBill: { entity: 'Bill', isSearch: false },
    findBills: { entity: 'Bill', isSearch: true },
  };

  function createMockQb() {
    return {
      getCustomer(id: string, cb: Function) { cb(null, makeCustomer({ Id: id })); },
      findCustomers(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Customer: [makeCustomer()], totalCount: 1 } });
      },
      getEmployee(id: string, cb: Function) { cb(null, makeEmployee({ Id: id })); },
      findEmployees(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Employee: [makeEmployee()] } });
      },
      getVendor(id: string, cb: Function) { cb(null, makeVendor({ Id: id })); },
      findVendors(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Vendor: [makeVendor()] } });
      },
      findInvoices(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Invoice: [{ Id: '1', TotalAmt: 100, BillAddr: { Line1: '123 Main St' }, BillEmail: { Address: 'test@example.com' } }] } });
      },
      // Write methods that should be blocked
      createInvoice(data: any, cb: Function) { cb(null, { Id: '99' }); },
      updateCustomer(data: any, cb: Function) { cb(null, { Id: '1' }); },
      deletePayment(data: any, cb: Function) { cb(null, { Id: '1' }); },
      voidInvoice(data: any, cb: Function) { cb(null, { Id: '1' }); },
      sendInvoicePdf(id: string, cb: Function) { cb(null, {}); },
      batch(items: any, cb: Function) { cb(null, {}); },
      upload(data: any, cb: Function) { cb(null, {}); },
      changeDataCapture(entities: any, since: string, cb: Function) { cb(null, {}); },
      someProperty: 'hello',
    };
  }

  function wrapWithReadOnlyProxy(qb: any) {
    return new Proxy(qb, {
      get(target: any, prop: string) {
        const original = target[prop];

        if (typeof original !== 'function') {
          return original;
        }

        if (!ALLOWED_METHODS.has(prop)) {
          return () => {
            throw new Error(`Blocked: ${prop} is not allowed. This server is read-only.`);
          };
        }

        const piiMapping = PII_MAP[prop];
        if (piiMapping) {
          return (...args: any[]) => {
            const lastIdx = args.length - 1;
            if (lastIdx >= 0 && typeof args[lastIdx] === 'function') {
              args[lastIdx] = wrapCallback(piiMapping.entity, piiMapping.isSearch, args[lastIdx]);
            }
            return original.apply(target, args);
          };
        }

        return original.bind(target);
      },
    });
  }

  // -- Write method blocking --

  it('blocks createInvoice', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.createInvoice({ Amount: 100 }, () => {})).toThrow('Blocked: createInvoice is not allowed');
  });

  it('blocks updateCustomer', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.updateCustomer({ Id: '1' }, () => {})).toThrow('Blocked: updateCustomer is not allowed');
  });

  it('blocks deletePayment', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.deletePayment({ Id: '1' }, () => {})).toThrow('Blocked: deletePayment is not allowed');
  });

  it('blocks voidInvoice', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.voidInvoice({ Id: '1' }, () => {})).toThrow('Blocked: voidInvoice is not allowed');
  });

  it('blocks sendInvoicePdf', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.sendInvoicePdf('1', () => {})).toThrow('Blocked: sendInvoicePdf is not allowed');
  });

  it('blocks batch operations', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.batch([], () => {})).toThrow('Blocked: batch is not allowed');
  });

  it('blocks upload', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.upload({}, () => {})).toThrow('Blocked: upload is not allowed');
  });

  it('blocks changeDataCapture', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(() => proxy.changeDataCapture([], '2026-01-01', () => {})).toThrow('Blocked: changeDataCapture is not allowed');
  });

  // -- Allowed read methods still work --

  it('allows findInvoices through', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    proxy.findInvoices([], (err: any, result: any) => {
      expect(result.QueryResponse.Invoice).toHaveLength(1);
    });
  });

  it('allows getCustomer through (with PII filtering)', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    proxy.getCustomer('1', (err: any, result: any) => {
      expect(result).toHaveProperty('DisplayName');
      expect(result).not.toHaveProperty('PrimaryPhone');
    });
  });

  // -- PII filtering still works --

  it('cannot access raw methods by extracting function reference', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    const fn = proxy.getCustomer;
    let resultData: any;
    fn('1', (err: any, result: any) => {
      resultData = result;
    });
    expect(resultData).not.toHaveProperty('PrimaryPhone');
    expect(resultData).not.toHaveProperty('PrimaryEmailAddr');
    expect(resultData).toHaveProperty('DisplayName');
  });

  it('strips BillAddr and BillEmail from invoice responses through proxy', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    proxy.findInvoices([], (err: any, result: any) => {
      const invoice = result.QueryResponse.Invoice[0];
      expect(invoice).not.toHaveProperty('BillAddr');
      expect(invoice).not.toHaveProperty('BillEmail');
      expect(invoice).toHaveProperty('Id', '1');
      expect(invoice).toHaveProperty('TotalAmt', 100);
    });
  });

  it('sanitizes employee SSN even when called rapidly in sequence', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    const results: any[] = [];

    for (let i = 0; i < 10; i++) {
      proxy.getEmployee(String(i), (err: any, result: any) => {
        results.push(result);
      });
    }

    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r).not.toHaveProperty('SSN');
      expect(r).not.toHaveProperty('BirthDate');
      expect(r).toHaveProperty('DisplayName');
    }
  });

  it('passes through non-function properties', () => {
    const proxy = wrapWithReadOnlyProxy(createMockQb());
    expect(proxy.someProperty).toBe('hello');
  });
});
