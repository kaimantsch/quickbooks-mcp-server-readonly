import { describe, it, expect } from 'vitest';
import { sanitizeCustomer, sanitizeEmployee, sanitizeVendor, wrapCallback } from '../src/helpers/sanitize-pii.js';

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

  it('returns the original callback for unknown entity types', () => {
    const cb = (err: any, result: any) => {};
    const wrapped = wrapCallback('Invoice', false, cb);
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
      // Non-PII method -- should pass through untouched
      findInvoices(criteria: any, cb: Function) {
        cb(null, { QueryResponse: { Invoice: [{ Id: '1', TotalAmt: 100 }] } });
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

  it('does not interfere with non-PII methods', () => {
    const proxy = wrapWithProxy(createMockQb());
    proxy.findInvoices([], (err: any, result: any) => {
      expect(result.QueryResponse.Invoice).toEqual([{ Id: '1', TotalAmt: 100 }]);
    });
  });

  it('passes through non-function properties', () => {
    const proxy = wrapWithProxy(createMockQb());
    expect(proxy.someProperty).toBe('hello');
  });
});
