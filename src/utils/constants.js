/**
 * Constants used throughout the meta-sync application
 */

export const METAFIELD_OWNER_TYPES = [
  'ARTICLE',
  'BLOG',
  'COLLECTION',
  'COMPANY',
  'COMPANY_LOCATION',
  'CUSTOMER',
  'DRAFTORDER',
  'LOCATION',
  'MARKET',
  'ORDER',
  'PAGE',
  'PRODUCT',
  'PRODUCTVARIANT',
  'SHOP',
];

export const DEPENDENCY_ERROR_PATTERNS = [
  'not found',
  'does not exist',
  'metaobject_reference',
  'invalid reference',
  'invalid_option',
  'validations must be a valid metaobject',
];

export const METAOBJECT_REFERENCE_VALIDATION_KEY = 'metaobject_definition_id';

export const MAX_DEPENDENCY_PASSES = 3;
export const PASS_DELAY_MS = 2000;
export const CREATION_DELAY_MS = 100;

// Entry operation constants
export const ENTRY_CONFLICT_ACTIONS = {
  UPDATE: 'update',
  SKIP: 'skip',
  UPDATE_ALL: 'update_all',
  SKIP_ALL: 'skip_all',
  QUIT: 'quit',
};

export const ENTRY_OPERATION_MODES = {
  DEFINITIONS_ONLY: 'definitions-only',
  DEFINITIONS_AND_ENTRIES: 'definitions-and-entries',
};

// Reserved Shopify namespaces and prefixes that cannot be managed by third-party apps
export const RESERVED_METAFIELD_NAMESPACES = [
  'shopify',
  'shopify--discovery',
  'shopify--discovery--product_search_boost',
  'shopify--discovery--product_recommendation',
];

export const RESERVED_METAOBJECT_PREFIXES = ['shopify--'];

/**
 * Check if a metafield namespace is reserved by Shopify
 * @param {string} namespace - The metafield namespace to check
 * @returns {boolean} - True if the namespace is reserved
 */
export function isReservedMetafieldNamespace(namespace) {
  return RESERVED_METAFIELD_NAMESPACES.some(
    (reserved) =>
      namespace === reserved || namespace.startsWith(reserved + '--')
  );
}

/**
 * Check if a metaobject type is reserved by Shopify
 * @param {string} type - The metaobject type to check
 * @returns {boolean} - True if the type is reserved
 */
export function isReservedMetaobjectType(type) {
  return RESERVED_METAOBJECT_PREFIXES.some((prefix) => type.startsWith(prefix));
}

// Resource type filtering constants and utilities
export const RESOURCE_TYPES = {
  METAFIELDS: 'metafields',
  METAOBJECTS: 'metaobjects',
  BOTH: 'both',
};

export const RESOURCE_TYPE_OPTIONS = [
  RESOURCE_TYPES.METAFIELDS,
  RESOURCE_TYPES.METAOBJECTS,
  RESOURCE_TYPES.BOTH,
];

/**
 * Filter definitions based on resource type selection
 * @param {Object} definitions - Object containing metafields and metaobjects arrays
 * @param {string} resourceType - Type of resources to include ('metafields', 'metaobjects', 'both')
 * @returns {Object} - Filtered definitions object
 */
export function filterDefinitionsByResourceType(definitions, resourceType) {
  // Validate resource type
  if (!RESOURCE_TYPE_OPTIONS.includes(resourceType)) {
    throw new Error(
      `Invalid resource type: ${resourceType}. Must be one of: ${RESOURCE_TYPE_OPTIONS.join(
        ', '
      )}`
    );
  }

  const result = {
    metafields: [],
    metaobjects: [],
  };

  if (
    resourceType === RESOURCE_TYPES.METAFIELDS ||
    resourceType === RESOURCE_TYPES.BOTH
  ) {
    result.metafields = definitions.metafields || [];
  }

  if (
    resourceType === RESOURCE_TYPES.METAOBJECTS ||
    resourceType === RESOURCE_TYPES.BOTH
  ) {
    result.metaobjects = definitions.metaobjects || [];
  }

  return result;
}
