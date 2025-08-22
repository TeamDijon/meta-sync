export class ShopifyClient {
  constructor(token, storeName = null) {
    if (!token) {
      throw new Error('Shopify access token is required');
    }

    this.token = token;
    this.storeName = storeName || this.extractStoreFromToken(token);
    this.apiUrl = `https://${this.storeName}.myshopify.com/admin/api/2025-01/graphql.json`;
  }

  extractStoreFromToken(token) {
    // For now, we'll require store name to be passed or set in env
    // In the future, we could extract from token if it contains store info
    throw new Error(
      'Store name must be provided or set in environment variables'
    );
  }

  async query(query, variables = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.token,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      throw new Error(`Shopify API request failed: ${error.message}`);
    }
  }

  // Metafield Definition Operations
  async getMetafieldDefinitions(ownerType = null) {
    let query, variables;

    if (ownerType) {
      // Query with specific owner type
      query = `
        query GetMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int) {
          metafieldDefinitions(ownerType: $ownerType, first: $first) {
            edges {
              node {
                id
                name
                namespace
                key
                description
                type {
                  name
                }
                ownerType
                access {
                  admin
                  storefront
                }
                validations {
                  name
                  type
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;
      variables = { ownerType, first: 100 };
    } else {
      // Query for all metafield definitions
      query = `
        query GetMetafieldDefinitions($first: Int) {
          metafieldDefinitions(first: $first) {
            edges {
              node {
                id
                name
                namespace
                key
                description
                type {
                  name
                }
                ownerType
                access {
                  admin
                  storefront
                }
                validations {
                  name
                  type
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;
      variables = { first: 100 };
    }

    return await this.query(query, variables);
  }

  async createMetafieldDefinition(definition) {
    const mutation = `
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            namespace
            key
            type {
              name
            }
            ownerType
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    return await this.query(mutation, { definition });
  }

  async deleteMetafieldDefinition(id) {
    const mutation = `
      mutation DeleteMetafieldDefinition($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
        metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) {
          deletedDefinitionId
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    return await this.query(mutation, {
      id,
      deleteAllAssociatedMetafields: true,
    });
  }

  // Metaobject Definition Operations
  async getMetaobjectDefinitions() {
    const query = `
      query GetMetaobjectDefinitions($first: Int) {
        metaobjectDefinitions(first: $first) {
          edges {
            node {
              id
              name
              type
              description
              access {
                admin
                storefront
              }
              fieldDefinitions {
                key
                name
                type {
                  name
                }
                description
                required
                validations {
                  name
                  type
                  value
                }
              }
              capabilities {
                publishable {
                  enabled
                }
                translatable {
                  enabled
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return await this.query(query, { first: 100 });
  }

  async createMetaobjectDefinition(definition) {
    const mutation = `
      mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            name
            type
            fieldDefinitions {
              key
              name
              type {
                name
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    return await this.query(mutation, { definition });
  }

  async deleteMetaobjectDefinition(id) {
    const mutation = `
      mutation DeleteMetaobjectDefinition($id: ID!) {
        metaobjectDefinitionDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    return await this.query(mutation, { id });
  }
}
