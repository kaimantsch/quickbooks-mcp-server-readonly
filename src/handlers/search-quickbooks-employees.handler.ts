import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { sanitizeEmployee } from "../helpers/sanitize-pii.js";
import { buildQuickbooksSearchCriteria } from "../helpers/build-quickbooks-search-criteria.js";

/**
 * Search employees in QuickBooks Online that match given criteria
 */
export async function searchQuickbooksEmployees(params: any): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    const criteria = buildQuickbooksSearchCriteria(params);

    return new Promise((resolve) => {
      quickbooks.findEmployees(criteria, (err: any, employees: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          const list = employees?.QueryResponse?.Employee || [];
          const sanitized = list.map(sanitizeEmployee);
          resolve({
            result: { ...employees, QueryResponse: { ...employees.QueryResponse, Employee: sanitized } },
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
