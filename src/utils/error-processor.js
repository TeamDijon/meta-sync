/**
 * Standardized error handling utilities
 * Provides consistent error processing and reporting across the application
 */

/**
 * Standard error types for the application
 */
export const ERROR_TYPES = {
  SHOPIFY_API: 'shopify_api',
  VALIDATION: 'validation',
  FILE_IO: 'file_io',
  NETWORK: 'network',
  DEPENDENCY: 'dependency',
  RESERVED_RESOURCE: 'reserved_resource',
  CONFLICT: 'conflict',
  USER_CANCELLED: 'user_cancelled',
};

/**
 * Standard error processor for Shopify API responses
 */
export class ErrorProcessor {
  static processShopifyErrors(response, operation, identifier) {
    const errors = [];

    if (response.userErrors && response.userErrors.length > 0) {
      response.userErrors.forEach((error) => {
        errors.push({
          type: ERROR_TYPES.SHOPIFY_API,
          operation,
          identifier,
          field: error.field,
          message: error.message,
          code: error.code,
        });
      });
    }

    return errors;
  }

  /**
   * Check if errors indicate a dependency issue
   */
  static isDependencyError(errors) {
    return errors.some(
      (error) =>
        error.message &&
        DEPENDENCY_ERROR_PATTERNS.some((pattern) =>
          error.message.toLowerCase().includes(pattern)
        )
    );
  }

  /**
   * Format error for logging
   */
  static formatErrorForLog(error) {
    return {
      type: error.type,
      operation: error.operation,
      identifier: error.identifier,
      message: error.message,
      ...(error.field && { field: error.field }),
      ...(error.code && { code: error.code }),
    };
  }

  /**
   * Create standardized error response
   */
  static createErrorResponse(
    type,
    operation,
    identifier,
    message,
    details = {}
  ) {
    return {
      type,
      operation,
      identifier,
      message,
      ...details,
    };
  }
}
