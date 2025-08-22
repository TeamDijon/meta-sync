import { FRAGMENTS, QUERIES } from './graphql-fragments.js';
import { ErrorProcessor } from '../utils/error-processor.js';

export class ShopifyClient {
  constructor(token, storeName = null) {
    if (!token) {
      throw new Error('Shopify access token is required');
    }

    this.token = token;
    this.storeName = storeName || this.extractStoreFromToken(token);
    this.apiUrl = `https://${this.storeName}.myshopify.com/admin/api/2025-10/graphql.json`;
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
    const filters = ownerType ? 'ownerType: $ownerType' : '';
    const filterVariables = ownerType ? '$ownerType: MetafieldOwnerType!' : '';
    const query = QUERIES.buildPaginatedQuery(
      'metafieldDefinitions',
      FRAGMENTS.METAFIELD_DEFINITION,
      filters,
      filterVariables
    );

    const variables = { first: 100 };
    if (ownerType) {
      variables.ownerType = ownerType;
    }

    return await this.query(query, variables);
  }

  async createMetafieldDefinition(definition) {
    const mutation = QUERIES.buildCreateMutation(
      'metafieldDefinitionCreate',
      'MetafieldDefinitionInput!',
      `createdDefinition { ${FRAGMENTS.METAFIELD_DEFINITION} }`
    );

    const response = await this.query(mutation, { definition });
    const result = ErrorProcessor.processShopifyErrors(
      response.metafieldDefinitionCreate,
      'createMetafieldDefinition',
      `${definition.namespace}.${definition.key}`
    );

    return {
      success: result.length === 0,
      data: response.metafieldDefinitionCreate?.createdDefinition,
      errors: result,
    };
  }

  async deleteMetafieldDefinition(id) {
    const mutation = `
      mutation DeleteMetafieldDefinition($id: ID!) {
        metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: true) {
          deletedDefinitionId
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const response = await this.query(mutation, { id });
    const result = ErrorProcessor.processShopifyErrors(
      response.metafieldDefinitionDelete,
      'deleteMetafieldDefinition',
      id
    );

    return {
      success: result.length === 0,
      data: response.metafieldDefinitionDelete?.deletedDefinitionId,
      errors: result,
    };
  }

  // Metaobject Definition Operations
  async getMetaobjectDefinitions() {
    const query = QUERIES.buildPaginatedQuery(
      'metaobjectDefinitions',
      FRAGMENTS.METAOBJECT_DEFINITION
    );
    return await this.query(query, { first: 100 });
  }

  async createMetaobjectDefinition(definition) {
    const mutation = QUERIES.buildCreateMutation(
      'metaobjectDefinitionCreate',
      'MetaobjectDefinitionCreateInput!',
      `metaobjectDefinition { ${FRAGMENTS.METAOBJECT_DEFINITION} }`
    );

    const response = await this.query(mutation, { definition });
    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectDefinitionCreate,
      'createMetaobjectDefinition',
      definition.type
    );

    return {
      success: result.length === 0,
      data: response.metaobjectDefinitionCreate?.metaobjectDefinition,
      errors: result,
    };
  }

  async deleteMetaobjectDefinition(id) {
    const mutation = `
      mutation DeleteMetaobjectDefinition($id: ID!) {
        metaobjectDefinitionDelete(id: $id) {
          deletedId
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const response = await this.query(mutation, { id });
    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectDefinitionDelete,
      'deleteMetaobjectDefinition',
      id
    );

    return {
      success: result.length === 0,
      data: response.metaobjectDefinitionDelete?.deletedId,
      errors: result,
    };
  }

  // Metaobject Entry Operations
  async getMetaobjectEntries(type, first = 250, after = null) {
    const query = QUERIES.buildPaginatedQuery(
      'metaobjects',
      FRAGMENTS.METAOBJECT_ENTRY,
      'type: $type',
      '$type: String!'
    );
    const response = await this.query(query, { type, first, after });

    return response;
  }

  async getMetaobjectDefinitionWithEntriesCount(type) {
    const query = `
      query GetMetaobjectDefinitionWithEntriesCount($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          name
          type
          metaobjectsCount
        }
      }
    `;

    return await this.query(query, { type });
  }

  async getMetaobjectByHandle(type, handle) {
    const query = `
      query GetMetaobjectByHandle($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          ${FRAGMENTS.METAOBJECT_ENTRY}
        }
      }
    `;

    return await this.query(query, { handle: { type, handle } });
  }

  async createMetaobjectEntry(type, handle, fields, capabilities = null) {
    const mutation = `
      mutation($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { ${FRAGMENTS.METAOBJECT_ENTRY} }
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const metaobject = {
      type,
      handle,
      fields: fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
    };

    if (capabilities) {
      metaobject.capabilities = capabilities;
    }

    const response = await this.query(mutation, { metaobject });
    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectCreate,
      'createMetaobjectEntry',
      `${type}:${handle}`
    );

    return {
      success: result.length === 0,
      data: response.metaobjectCreate?.metaobject,
      errors: result,
    };
  }

  async updateMetaobjectEntry(id, fields, capabilities = null) {
    const mutation = `
      mutation UpdateMetaobjectEntry($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            ${FRAGMENTS.METAOBJECT_ENTRY}
          }
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const metaobject = {
      fields: fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
    };

    if (capabilities) {
      metaobject.capabilities = capabilities;
    }

    const response = await this.query(mutation, { id, metaobject });
    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectUpdate,
      'updateMetaobjectEntry',
      id
    );

    return {
      success: result.length === 0,
      data: response.metaobjectUpdate?.metaobject,
      errors: result,
    };
  }

  async upsertMetaobjectEntry(type, handle, fields, capabilities = null) {
    const mutation = `
      mutation UpsertMetaobjectEntry($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
        metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
          metaobject {
            ${FRAGMENTS.METAOBJECT_ENTRY}
          }
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const metaobject = {
      fields: fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
    };

    if (capabilities) {
      metaobject.capabilities = capabilities;
    }

    const response = await this.query(mutation, {
      handle: { type, handle },
      metaobject,
    });

    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectUpsert,
      'upsertMetaobjectEntry',
      `${type}:${handle}`
    );

    return {
      success: result.length === 0,
      data: response.metaobjectUpsert?.metaobject,
      errors: result,
    };
  }

  async deleteMetaobjectEntry(id) {
    const mutation = `
      mutation DeleteMetaobjectEntry($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          ${FRAGMENTS.ERROR_FRAGMENT}
        }
      }
    `;

    const response = await this.query(mutation, { id });
    const result = ErrorProcessor.processShopifyErrors(
      response.metaobjectDelete,
      'deleteMetaobjectEntry',
      id
    );

    return {
      success: result.length === 0,
      data: response.metaobjectDelete?.deletedId,
      errors: result,
    };
  }
}
