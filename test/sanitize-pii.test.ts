import { describe, it, expect } from 'vitest';
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
    // PII fields
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
    // PII fields
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
    // PII fields
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
// sanitizeCustomer
// ---------------------------------------------------------------------------

describe('sanitizeCustomer', () => {
  const CUSTOMER_PII = ['PrimaryAddr', 'BillAddr', 'ShipAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate'];

  it('removes all PII fields', () => {
    const result = sanitizeCustomer(makeCustomer());
    for (const field of CUSTOMER_PII) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('preserves non-PII fields', () => {
    const result = sanitizeCustomer(makeCustomer());
    expect(result).toHaveProperty('Id', '1');
    expect(result).toHaveProperty('DisplayName', "Amy's Bird Sanctuary");
    expect(result).toHaveProperty('GivenName', 'Amy');
    expect(result).toHaveProperty('Balance', 239);
    expect(result).toHaveProperty('Active', true);
  });

  it('does not mutate the original object', () => {
    const original = makeCustomer();
    sanitizeCustomer(original);
    expect(original).toHaveProperty('PrimaryPhone');
    expect(original).toHaveProperty('PrimaryEmailAddr');
  });

  it('handles missing PII fields gracefully', () => {
    const sparse = { Id: '2', DisplayName: 'Sparse Customer', Balance: 0 };
    const result = sanitizeCustomer(sparse);
    expect(result).toEqual(sparse);
  });
});

// ---------------------------------------------------------------------------
// sanitizeEmployee
// ---------------------------------------------------------------------------

describe('sanitizeEmployee', () => {
  const EMPLOYEE_PII = ['SSN', 'PrimaryAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate'];

  it('removes all PII fields including SSN', () => {
    const result = sanitizeEmployee(makeEmployee());
    for (const field of EMPLOYEE_PII) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('preserves non-PII fields', () => {
    const result = sanitizeEmployee(makeEmployee());
    expect(result).toHaveProperty('Id', '1');
    expect(result).toHaveProperty('DisplayName', 'John Smith');
    expect(result).toHaveProperty('Active', true);
  });

  it('does not mutate the original object', () => {
    const original = makeEmployee();
    sanitizeEmployee(original);
    expect(original).toHaveProperty('SSN');
    expect(original).toHaveProperty('PrimaryEmailAddr');
  });
});

// ---------------------------------------------------------------------------
// sanitizeVendor
// ---------------------------------------------------------------------------

describe('sanitizeVendor', () => {
  const VENDOR_PII = ['PrimaryAddr', 'PrimaryPhone', 'Mobile', 'Fax', 'PrimaryEmailAddr', 'AcctNum'];

  it('removes all PII fields including Fax and AcctNum', () => {
    const result = sanitizeVendor(makeVendor());
    for (const field of VENDOR_PII) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('preserves non-PII fields', () => {
    const result = sanitizeVendor(makeVendor());
    expect(result).toHaveProperty('Id', '1');
    expect(result).toHaveProperty('DisplayName', 'Acme Supplies');
    expect(result).toHaveProperty('Balance', 500);
  });

  it('does not mutate the original object', () => {
    const original = makeVendor();
    sanitizeVendor(original);
    expect(original).toHaveProperty('AcctNum');
    expect(original).toHaveProperty('Fax');
  });
});

// ---------------------------------------------------------------------------
// sanitizeInvoice
// ---------------------------------------------------------------------------

describe('sanitizeInvoice', () => {
  const INVOICE_PII = ['BillAddr', 'ShipAddr', 'BillEmail', 'RemitToAddr', 'ShipFromAddr'];

  function makeInvoice(overrides: Record<string, any> = {}) {
    return {
      Id: '130',
      DocNumber: '1037',
      TxnDate: '2026-02-27',
      TotalAmt: 362.07,
      Balance: 362.07,
      CustomerRef: { value: '24', name: 'Sonnenschein Family Store' },
      // PII fields
      BillAddr: { Id: '95', Line1: 'Russ Sonnenschein', Line3: '5647 Cypress Hill Ave.', Lat: '37.42', Long: '-122.11' },
      ShipAddr: { Line1: '5647 Cypress Hill Ave.', City: 'Middlefield', PostalCode: '94303' },
      BillEmail: { Address: 'Familiystore@intuit.com' },
      ...overrides,
    };
  }

  it('removes all PII fields', () => {
    const result = sanitizeInvoice(makeInvoice());
    for (const field of INVOICE_PII) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('preserves non-PII fields', () => {
    const result = sanitizeInvoice(makeInvoice());
    expect(result).toHaveProperty('Id', '130');
    expect(result).toHaveProperty('DocNumber', '1037');
    expect(result).toHaveProperty('TotalAmt', 362.07);
    expect(result).toHaveProperty('CustomerRef');
  });

  it('does not mutate the original object', () => {
    const original = makeInvoice();
    sanitizeInvoice(original);
    expect(original).toHaveProperty('BillAddr');
    expect(original).toHaveProperty('BillEmail');
  });

  it('handles missing PII fields gracefully', () => {
    const sparse = { Id: '1', TotalAmt: 100 };
    const result = sanitizeInvoice(sparse);
    expect(result).toEqual(sparse);
  });
});

// ---------------------------------------------------------------------------
// sanitizeEstimate
// ---------------------------------------------------------------------------

describe('sanitizeEstimate', () => {
  it('removes address and email fields', () => {
    const estimate = {
      Id: '100',
      TotalAmt: 335.25,
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

  it('does not mutate the original object', () => {
    const original = { Id: '1', BillAddr: { Line1: '123 St.' } };
    sanitizeEstimate(original);
    expect(original).toHaveProperty('BillAddr');
  });
});

// ---------------------------------------------------------------------------
// sanitizeBill
// ---------------------------------------------------------------------------

describe('sanitizeBill', () => {
  it('removes VendorAddr and RemitToAddr', () => {
    const bill = {
      Id: '50',
      TotalAmt: 200,
      VendorRef: { value: '56', name: "Bob's Burger Joint" },
      VendorAddr: { Line1: '123 Vendor St.' },
      RemitToAddr: { Line1: '456 Remit Ln.' },
      ShipAddr: { Line1: '789 Ship St.' },
    };
    const result = sanitizeBill(bill);
    expect(result).not.toHaveProperty('VendorAddr');
    expect(result).not.toHaveProperty('RemitToAddr');
    expect(result).not.toHaveProperty('ShipAddr');
    expect(result).toHaveProperty('Id', '50');
    expect(result).toHaveProperty('VendorRef');
  });

  it('does not mutate the original object', () => {
    const original = { Id: '1', VendorAddr: { Line1: '123 St.' } };
    sanitizeBill(original);
    expect(original).toHaveProperty('VendorAddr');
  });
});

// ---------------------------------------------------------------------------
// wrapCallback -- single-entity (get) methods
// ---------------------------------------------------------------------------

describe('wrapCallback (get methods)', () => {
  it('sanitizes a Customer result', () => {
    const customer = makeCustomer();
    const wrapped = wrapCallback('Customer', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('PrimaryPhone');
      expect(result).not.toHaveProperty('PrimaryEmailAddr');
      expect(result).toHaveProperty('DisplayName');
    });
    wrapped(null, customer);
  });

  it('sanitizes an Employee result', () => {
    const employee = makeEmployee();
    const wrapped = wrapCallback('Employee', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('SSN');
      expect(result).not.toHaveProperty('BirthDate');
      expect(result).toHaveProperty('DisplayName');
    });
    wrapped(null, employee);
  });

  it('sanitizes a Vendor result', () => {
    const vendor = makeVendor();
    const wrapped = wrapCallback('Vendor', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('AcctNum');
      expect(result).not.toHaveProperty('Fax');
      expect(result).toHaveProperty('DisplayName');
    });
    wrapped(null, vendor);
  });

  it('passes errors through without sanitizing', () => {
    const error = new Error('QB error');
    const wrapped = wrapCallback('Customer', false, (err, result) => {
      expect(err).toBe(error);
      expect(result).toBeNull();
    });
    wrapped(error, null);
  });

  it('passes null result through', () => {
    const wrapped = wrapCallback('Customer', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).toBeNull();
    });
    wrapped(null, null);
  });

  it('sanitizes an Invoice result', () => {
    const invoice = { Id: '1', TotalAmt: 100, BillAddr: { Line1: '123 St.' }, BillEmail: { Address: 'test@example.com' } };
    const wrapped = wrapCallback('Invoice', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('BillAddr');
      expect(result).not.toHaveProperty('BillEmail');
      expect(result).toHaveProperty('TotalAmt', 100);
    });
    wrapped(null, invoice);
  });

  it('sanitizes an Estimate result', () => {
    const estimate = { Id: '100', TotalAmt: 335, BillAddr: { Line1: '456 Ave.' }, ShipAddr: { Line1: '456 Ave.' } };
    const wrapped = wrapCallback('Estimate', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('BillAddr');
      expect(result).not.toHaveProperty('ShipAddr');
      expect(result).toHaveProperty('TotalAmt', 335);
    });
    wrapped(null, estimate);
  });

  it('sanitizes a Bill result', () => {
    const bill = { Id: '50', TotalAmt: 200, VendorAddr: { Line1: '789 Rd.' } };
    const wrapped = wrapCallback('Bill', false, (err, result) => {
      expect(err).toBeNull();
      expect(result).not.toHaveProperty('VendorAddr');
      expect(result).toHaveProperty('TotalAmt', 200);
    });
    wrapped(null, bill);
  });

  it('returns the original callback for unknown entity types', () => {
    const cb = (err: any, result: any) => {};
    const wrapped = wrapCallback('UnknownEntity', false, cb);
    expect(wrapped).toBe(cb);
  });
});

// ---------------------------------------------------------------------------
// wrapCallback -- search (find) methods
// ---------------------------------------------------------------------------

describe('wrapCallback (find/search methods)', () => {
  it('sanitizes an array of Customers in QueryResponse', () => {
    const response = {
      QueryResponse: {
        Customer: [makeCustomer(), makeCustomer({ Id: '2', DisplayName: 'Bob' })],
        totalCount: 2,
      },
    };

    const wrapped = wrapCallback('Customer', true, (err, result) => {
      expect(err).toBeNull();
      const customers = result.QueryResponse.Customer;
      expect(customers).toHaveLength(2);
      for (const c of customers) {
        expect(c).not.toHaveProperty('PrimaryPhone');
        expect(c).not.toHaveProperty('PrimaryEmailAddr');
        expect(c).not.toHaveProperty('BillAddr');
        expect(c).not.toHaveProperty('ShipAddr');
      }
      expect(result.QueryResponse.totalCount).toBe(2);
    });
    wrapped(null, response);
  });

  it('sanitizes an array of Employees in QueryResponse', () => {
    const response = {
      QueryResponse: {
        Employee: [makeEmployee()],
      },
    };

    const wrapped = wrapCallback('Employee', true, (err, result) => {
      const employees = result.QueryResponse.Employee;
      expect(employees).toHaveLength(1);
      expect(employees[0]).not.toHaveProperty('SSN');
      expect(employees[0]).not.toHaveProperty('PrimaryAddr');
      expect(employees[0]).toHaveProperty('DisplayName');
    });
    wrapped(null, response);
  });

  it('sanitizes an array of Vendors in QueryResponse', () => {
    const response = {
      QueryResponse: {
        Vendor: [makeVendor()],
      },
    };

    const wrapped = wrapCallback('Vendor', true, (err, result) => {
      const vendors = result.QueryResponse.Vendor;
      expect(vendors).toHaveLength(1);
      expect(vendors[0]).not.toHaveProperty('AcctNum');
      expect(vendors[0]).not.toHaveProperty('Fax');
    });
    wrapped(null, response);
  });

  it('handles empty QueryResponse arrays', () => {
    const response = { QueryResponse: { Customer: [] } };
    const wrapped = wrapCallback('Customer', true, (err, result) => {
      expect(result.QueryResponse.Customer).toEqual([]);
    });
    wrapped(null, response);
  });

  it('handles missing entity key in QueryResponse', () => {
    const response = { QueryResponse: { totalCount: 0 } };
    const wrapped = wrapCallback('Customer', true, (err, result) => {
      expect(result).toEqual(response);
    });
    wrapped(null, response);
  });

  it('passes errors through without sanitizing', () => {
    const error = new Error('search failed');
    const wrapped = wrapCallback('Customer', true, (err, result) => {
      expect(err).toBe(error);
      expect(result).toBeNull();
    });
    wrapped(error, null);
  });
});

// ---------------------------------------------------------------------------
// Proxy integration (simulates what quickbooks-client.ts does)
// ---------------------------------------------------------------------------

describe('Proxy integration', () => {
  function createMockQb() {
    return {
      getCustomer(id: string, cb: Function) {
        cb(null, makeCustomer({ Id: id }));
      },
      findCustomers(criteria: any, cb: Function) {
        cb(null, {
          QueryResponse: {
            Customer: [makeCustomer(), makeCustomer({ Id: '2' })],
            totalCount: 2,
          },
        });
      },
      getEmployee(id: string, cb: Function) {
        cb(null, makeEmployee({ Id: id }));
      },
      findEmployees(criteria: any, cb: Function) {
        cb(null, {
          QueryResponse: {
            Employee: [makeEmployee()],
          },
        });
      },
      getVendor(id: string, cb: Function) {
        cb(null, makeVendor({ Id: id }));
      },
      findVendors(criteria: any, cb: Function) {
        cb(null, {
          QueryResponse: {
            Vendor: [makeVendor()],
          },
        });
      },
      findInvoices(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Invoice: [{ Id: '1', TotalAmt: 100, BillAddr: { Line1: '123 St.' }, BillEmail: { Address: 'test@test.com' } }] } });
      },
      findEstimates(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Estimate: [{ Id: '100', TotalAmt: 335, BillAddr: { Line1: '456 Ave.' }, ShipAddr: { Line1: '456 Ave.' } }] } });
      },
      findBills(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Bill: [{ Id: '50', TotalAmt: 200, VendorAddr: { Line1: '789 Rd.' } }] } });
      },
      // Non-PII method -- should pass through untouched
      findItems(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Item: [{ Id: '5', Name: 'Rock Fountain' }] } });
      },
      someProperty: 'hello',
    };
  }

  function wrapWithProxy(qb: any) {
    const METHOD_MAP: Record<string, { entity: string; isSearch: boolean }> = {
      getCustomer: { entity: 'Customer', isSearch: false },
      findCustomers: { entity: 'Customer', isSearch: true },
      getEmployee: { entity: 'Employee', isSearch: false },
      findEmployees: { entity: 'Employee', isSearch: true },
      getVendor: { entity: 'Vendor', isSearch: false },
      findVendors: { entity: 'Vendor', isSearch: true },
      findInvoices: { entity: 'Invoice', isSearch: true },
      findEstimates: { entity: 'Estimate', isSearch: true },
      findBills: { entity: 'Bill', isSearch: true },
    };

    return new Proxy(qb, {
      get(target: any, prop: string) {
        const original = target[prop];
        const mapping = METHOD_MAP[prop];
        if (typeof original === 'function' && mapping) {
          return (...args: any[]) => {
            const lastIdx = args.length - 1;
            if (lastIdx >= 0 && typeof args[lastIdx] === 'function') {
              args[lastIdx] = wrapCallback(mapping.entity, mapping.isSearch, args[lastIdx]);
            }
            return original.apply(target, args);
          };
        }
        return original;
      },
    });
  }

  it('strips PII from getCustomer through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.getCustomer('1', (err: any, result: any) => {
      expect(result).not.toHaveProperty('PrimaryPhone');
      expect(result).not.toHaveProperty('PrimaryEmailAddr');
      expect(result).not.toHaveProperty('BillAddr');
      expect(result).toHaveProperty('Id', '1');
      expect(result).toHaveProperty('DisplayName');
    });
  });

  it('strips PII from findCustomers through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findCustomers([{ limit: 10 }], (err: any, result: any) => {
      const customers = result.QueryResponse.Customer;
      expect(customers).toHaveLength(2);
      for (const c of customers) {
        expect(c).not.toHaveProperty('PrimaryPhone');
        expect(c).not.toHaveProperty('ShipAddr');
      }
    });
  });

  it('strips SSN from getEmployee through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.getEmployee('1', (err: any, result: any) => {
      expect(result).not.toHaveProperty('SSN');
      expect(result).not.toHaveProperty('BirthDate');
      expect(result).toHaveProperty('DisplayName');
    });
  });

  it('strips AcctNum from findVendors through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findVendors([], (err: any, result: any) => {
      const vendors = result.QueryResponse.Vendor;
      expect(vendors[0]).not.toHaveProperty('AcctNum');
      expect(vendors[0]).not.toHaveProperty('Fax');
    });
  });

  it('strips BillAddr and BillEmail from findInvoices through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findInvoices([], (err: any, result: any) => {
      const invoice = result.QueryResponse.Invoice[0];
      expect(invoice).not.toHaveProperty('BillAddr');
      expect(invoice).not.toHaveProperty('BillEmail');
      expect(invoice).toHaveProperty('Id', '1');
      expect(invoice).toHaveProperty('TotalAmt', 100);
    });
  });

  it('strips BillAddr from findEstimates through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findEstimates([], (err: any, result: any) => {
      const estimate = result.QueryResponse.Estimate[0];
      expect(estimate).not.toHaveProperty('BillAddr');
      expect(estimate).not.toHaveProperty('ShipAddr');
      expect(estimate).toHaveProperty('TotalAmt', 335);
    });
  });

  it('strips VendorAddr from findBills through proxy', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findBills([], (err: any, result: any) => {
      const bill = result.QueryResponse.Bill[0];
      expect(bill).not.toHaveProperty('VendorAddr');
      expect(bill).toHaveProperty('TotalAmt', 200);
    });
  });

  it('does not interfere with non-PII methods', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findItems([], (err: any, result: any) => {
      expect(result.QueryResponse.Item).toEqual([{ Id: '5', Name: 'Rock Fountain' }]);
    });
  });

  it('passes through non-function properties', () => {
    const proxy = wrapWithProxy(createMockQb());
    expect(proxy.someProperty).toBe('hello');
  });
});
