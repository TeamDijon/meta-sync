/**
 * Common GraphQL fragments and queries for Shopify API
 * Reduces duplication and ensures consistency across API calls
 */

// Common field fragments
export const FRAGMENTS = {
  METAFIELD_DEFINITION: `
    id
    name
    namespace
    key
    description
    type {
      name
      category
    }
    ownerType
    validations {
      name
      type
      value
    }
  `,

  METAOBJECT_DEFINITION: `
    id
    name
    type
    description
    displayNameKey
    fieldDefinitions {
      name
      key
      description
      type {
        name
        category
      }
      required
      validations {
        name
        type
        value
      }
    }
    access {
      admin
      storefront
    }
    capabilities {
      publishable {
        enabled
      }
      translatable {
        enabled
      }
    }
  `,

  METAOBJECT_ENTRY: `
    id
    type
    handle
    displayName
    fields {
      key
      value
      type
    }
    capabilities {
      publishable {
        status
      }
    }
  `,

  ERROR_FRAGMENT: `
    userErrors {
      field
      message
      code
    }
  `,
};

// Common query builders
export const QUERIES = {
  /**
   * Build a paginated query with consistent structure
   */
  buildPaginatedQuery(resource, fragment, filters = '') {
    return `
      query($first: Int!, $after: String) {
        ${resource}(first: $first, after: $after${
      filters ? ', ' + filters : ''
    }) {
          edges {
            node {
              ${fragment}
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
  },

  /**
   * Build a create mutation with consistent error handling
   */
  buildCreateMutation(mutationName, inputType, fragment) {
    return `
      mutation($input: ${inputType}!) {
        ${mutationName}(input: $input) {
          ${fragment}
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;
  },

  /**
   * Build a delete mutation with consistent error handling
   */
  buildDeleteMutation(mutationName, idType = 'ID!') {
    return `
      mutation($id: ${idType}) {
        ${mutationName}(id: $id) {
          deletedId
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;
  },
};
