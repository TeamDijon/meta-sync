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
