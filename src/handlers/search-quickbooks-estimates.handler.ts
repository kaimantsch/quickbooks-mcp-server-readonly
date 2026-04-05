import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { buildQuickbooksSearchCriteria, QuickbooksSearchCriteriaInput } from "../helpers/build-quickbooks-search-criteria.js";

/**
 * Search estimates from QuickBooks Online using the supplied criteria.
 */
export async function searchQuickbooksEstimates(criteria: QuickbooksSearchCriteriaInput = {}): Promise<ToolResponse<any[]>> {
  try {
    const normalizedCriteria = buildQuickbooksSearchCriteria(criteria);
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    return new Promise((resolve) => {
      (quickbooks as any).findEstimates(normalizedCriteria as any, (err: any, estimates: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          resolve({
            result:
              estimates?.QueryResponse?.Estimate ??
              estimates?.QueryResponse?.totalCount ??
              [],
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