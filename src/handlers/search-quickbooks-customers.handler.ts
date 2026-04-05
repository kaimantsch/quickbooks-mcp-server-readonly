import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { sanitizeCustomer } from "../helpers/sanitize-pii.js";
import { buildQuickbooksSearchCriteria, QuickbooksSearchCriteriaInput } from "../helpers/build-quickbooks-search-criteria.js";

/**
 * Search customers from QuickBooks Online.
 *
 * Accepts either:
 *   - A plain criteria object (key/value pairs) -- passed directly to findCustomers
 *   - An **array** of objects in the `{ field, value, operator? }` shape -- this
 *     allows use of operators such as `IN`, `LIKE`, `>`, `<`, `>=`, `<=` etc.
 *
 * Pagination / sorting options such as `limit`, `offset`, `asc`, `desc`,
 * `fetchAll`, `count` can be supplied via the top-level criteria object or as
 * dedicated entries in the array form (see README in user prompt).
 */
export async function searchQuickbooksCustomers(criteria: QuickbooksSearchCriteriaInput = {}): Promise<ToolResponse<any[]>> {
  try {
    const normalizedCriteria = buildQuickbooksSearchCriteria(criteria);
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    return new Promise((resolve) => {
      (quickbooks as any).findCustomers(normalizedCriteria as any, (err: any, customers: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          const list = customers?.QueryResponse?.Customer ?? [];
          resolve({
            result: Array.isArray(list) ? list.map(sanitizeCustomer) : list,
            isError: false,
            error: null,
          });
        }
      });
    });
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
