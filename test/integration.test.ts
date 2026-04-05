import { describe, it, expect, beforeAll } from 'vitest';
import { quickbooksClient } from '../src/clients/quickbooks-client.js';

const CUSTOMER_PII = ['PrimaryAddr', 'BillAddr', 'ShipAddr', 'PrimaryPhone', 'Mobile', 'PrimaryEmailAddr', 'BirthDate'];
const VENDOR_PII = ['PrimaryAddr', 'PrimaryPhone', 'Mobile', 'Fax', 'PrimaryEmailAddr', 'AcctNum'];

let qb: any;

beforeAll(async () => {
  qb = await quickbooksClient.authenticate();
});

describe('integration: first customer', () => {
  it('returns a customer with no PII fields', async () => {
    const customer = await new Promise<any>((resolve, reject) => {
      qb.findCustomers([{ limit: 1 }], (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result.QueryResponse.Customer[0]);
      });
    });

    expect(customer).toBeDefined();
    expect(customer.Id).toBeDefined();
    expect(customer.DisplayName).toBeDefined();

    for (const field of CUSTOMER_PII) {
      expect(customer, `PII field "${field}" should be stripped`).not.toHaveProperty(field);
    }
  });
});

describe('integration: first vendor', () => {
  it('returns a vendor with no PII fields', async () => {
    const vendor = await new Promise<any>((resolve, reject) => {
      qb.findVendors([{ limit: 1 }], (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result.QueryResponse.Vendor[0]);
      });
    });

    expect(vendor).toBeDefined();
    expect(vendor.Id).toBeDefined();
    expect(vendor.DisplayName).toBeDefined();

    for (const field of VENDOR_PII) {
      expect(vendor, `PII field "${field}" should be stripped`).not.toHaveProperty(field);
    }
  });
});

describe('integration: first invoice', () => {
  it('returns an invoice with expected fields', async () => {
    const invoice = await new Promise<any>((resolve, reject) => {
      qb.findInvoices([{ limit: 1 }], (err: any, result: any) => {
        if (err) return reject(err);
        resolve(result.QueryResponse.Invoice[0]);
      });
    });

    expect(invoice).toBeDefined();
    expect(invoice.Id).toBeDefined();
    expect(invoice.TotalAmt).toBeDefined();
    expect(invoice.DocNumber).toBeDefined();
  });
});
