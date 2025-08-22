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
