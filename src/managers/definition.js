import {
  METAFIELD_OWNER_TYPES,
  DEPENDENCY_ERROR_PATTERNS,
  METAOBJECT_REFERENCE_VALIDATION_KEY,
  MAX_DEPENDENCY_PASSES,
  PASS_DELAY_MS,
  CREATION_DELAY_MS,
  ENTRY_CONFLICT_ACTIONS,
  ENTRY_OPERATION_MODES,
  isReservedMetafieldNamespace,
  isReservedMetaobjectType,
} from '../utils/constants.js';
import { EntryConflictResolver } from '../utils/entry-conflict.js';

export class DefinitionManager {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Generic helper for operations on collections of definitions with consistent error handling
   */
  async processDefinitions(definitions, operation, options = {}) {
    const {
      dryRun = false,
      itemType = 'definition',
      getIdentifier = (def) => def.type || `${def.namespace}/${def.key}`,
    } = options;

    const results = {
      metafields: { success: 0, errors: [] },
      metaobjects: { success: 0, errors: [] },
    };

    if (dryRun) {
      this.logger.dryRunInfo(
        `Would process ${
          definitions.metaobjects?.length || 0
        } metaobject definitions`
      );
      this.logger.dryRunInfo(
        `Would process ${
          definitions.metafields?.length || 0
        } metafield definitions`
      );
      return results;
    }

    // Process metaobjects first (they can't reference metafields, only other metaobjects)
    for (const def of definitions.metaobjects || []) {
      try {
        await operation.metaobject(def);
        results.metaobjects.success++;
      } catch (error) {
        results.metaobjects.errors.push({
          definition: def.type,
          error: error.message,
        });
        this.logger.error(
          `Failed to ${operation.name} metaobject ${def.type}:`,
          error.message
        );
      }
    }

    // Process metafields second (they can reference metaobjects that now exist)
    for (const def of definitions.metafields || []) {
      try {
        await operation.metafield(def);
        results.metafields.success++;
      } catch (error) {
        const identifier = `${def.namespace}/${def.key}`;
        results.metafields.errors.push({
          definition: identifier,
          error: error.message,
        });
        this.logger.error(
          `Failed to ${operation.name} metafield ${identifier}:`,
          error.message
        );
      }
    }

    return results;
  }

  /**
   * Filter out reserved Shopify definitions and log them
   * @param {Object} definitions - Object with metafields and metaobjects arrays
   * @returns {Object} - Filtered definitions object with stats
   */
  filterReservedDefinitions(definitions) {
    const filtered = { metafields: [], metaobjects: [] };
    const skipped = { metafields: [], metaobjects: [] };

    // Filter metafields
    for (const metafield of definitions.metafields || []) {
      if (isReservedMetafieldNamespace(metafield.namespace)) {
        skipped.metafields.push({
          key: `${metafield.namespace}/${metafield.key}`,
          reason: `Reserved namespace: ${metafield.namespace}`,
        });
        this.logger.warning(
          `Skipping reserved metafield: ${metafield.namespace}/${metafield.key} (reserved namespace)`
        );
      } else {
        filtered.metafields.push(metafield);
      }
    }

    // Filter metaobjects
    for (const metaobject of definitions.metaobjects || []) {
      if (isReservedMetaobjectType(metaobject.type)) {
        skipped.metaobjects.push({
          type: metaobject.type,
          reason: `Reserved type prefix: ${metaobject.type}`,
        });
        this.logger.warning(
          `Skipping reserved metaobject: ${metaobject.type} (reserved type prefix)`
        );
      } else {
        filtered.metaobjects.push(metaobject);
      }
    }

    // Log summary if any were skipped
    if (skipped.metafields.length > 0 || skipped.metaobjects.length > 0) {
      this.logger.info(
        `Skipped ${skipped.metafields.length} reserved metafields and ${skipped.metaobjects.length} reserved metaobjects`
      );
    }

    return { filtered, skipped };
  }

  async getAllDefinitions() {
    // Fetch metafields for each owner type
    const metafieldPromises = METAFIELD_OWNER_TYPES.map(async (ownerType) => {
      try {
        const result = await this.client.getMetafieldDefinitions(ownerType);
        return result.metafieldDefinitions.edges.map((e) => e.node);
      } catch (error) {
        // Some owner types might not be accessible (e.g., Company on non-Plus stores)
        this.logger.verbose(
          `Skipping ${ownerType} metafields: ${error.message}`
        );
        return [];
      }
    });

    // Fetch metaobjects
    const metaobjectResult = await this.client.getMetaobjectDefinitions();

    // Wait for all metafield requests to complete
    const metafieldResults = await Promise.all(metafieldPromises);
    const allMetafields = metafieldResults.flat();

    return {
      metafields: allMetafields,
      metaobjects: metaobjectResult.metaobjectDefinitions.edges.map(
        (e) => e.node
      ),
    };
  }

  /**
   * Format errors from client response for error messages
   * @param {Array} errors - Array of error objects
   * @returns {string} - Formatted error message
   */
  formatErrorMessage(errors) {
    if (!errors || errors.length === 0) {
      return 'Unknown error';
    }
    return errors.map((error) => error.message).join(', ');
  }

  async createMetafieldDefinition(def) {
    this.logger.verbose(
      `Creating metafield definition: ${def.namespace}/${def.key}`
    );

    const definitionInput = {
      name: def.name,
      namespace: def.namespace,
      key: def.key,
      description: def.description,
      type: def.type.name,
      ownerType: def.ownerType,
    };

    // Skip access controls - let target store use defaults
    // if (def.access) {
    //   definitionInput.access = {};
    //   // Map access levels from source to target compatible values
    //   if (def.access.admin) {
    //     const adminAccess = def.access.admin === 'PUBLIC_READ_WRITE' ? 'MERCHANT_READ_WRITE' :
    //                        def.access.admin === 'PUBLIC_READ' ? 'MERCHANT_READ' : def.access.admin;
    //     definitionInput.access.admin = adminAccess;
    //   }
    //   if (def.access.storefront) {
    //     const storefrontAccess = def.access.storefront === 'PUBLIC_READ_WRITE' ? 'PUBLIC_READ' :
    //                             def.access.storefront === 'PUBLIC_READ' ? 'PUBLIC_READ' : def.access.storefront;
    //     definitionInput.access.storefront = storefrontAccess;
    //   }
    // }

    // Add validations
    if (def.validations && def.validations.length > 0) {
      definitionInput.validations = def.validations.map((v) => ({
        name: v.name,
        value: v.value,
      }));
    }

    const result = await this.client.createMetafieldDefinition(definitionInput);

    if (!result.success) {
      throw new Error(
        `Failed to create metafield definition ${def.namespace}/${
          def.key
        }: ${this.formatErrorMessage(result.errors)}`
      );
    }

    return result.data;
  }

  async createMetaobjectDefinition(def) {
    this.logger.verbose(`Creating metaobject definition: ${def.type}`);

    const definitionInput = {
      name: def.name,
      type: def.type,
      description: def.description,
      fieldDefinitions: def.fieldDefinitions.map((field) => ({
        key: field.key,
        name: field.name,
        type: field.type.name,
        description: field.description,
        required: field.required,
        // Add field validations if they exist
        ...(field.validations &&
          field.validations.length > 0 && {
            validations: field.validations.map((v) => ({
              name: v.name,
              value: v.value,
            })),
          }),
      })),
    };

    // Add capabilities
    if (def.capabilities) {
      definitionInput.capabilities = {};
      if (def.capabilities.publishable?.enabled) {
        definitionInput.capabilities.publishable = { enabled: true };
      }
      if (def.capabilities.translatable?.enabled) {
        definitionInput.capabilities.translatable = { enabled: true };
      }
    }

    const result = await this.client.createMetaobjectDefinition(
      definitionInput
    );

    if (!result.success) {
      throw new Error(
        `Failed to create metaobject definition ${
          def.type
        }: ${this.formatErrorMessage(result.errors)}`
      );
    }

    return result.data;
  }

  async deleteMetafieldDefinition(def) {
    this.logger.verbose(
      `Deleting metafield definition: ${def.namespace}/${def.key} (including all associated metafield values)`
    );

    const result = await this.client.deleteMetafieldDefinition(def.id);

    if (!result.success) {
      throw new Error(
        `Failed to delete metafield definition ${def.namespace}/${
          def.key
        }: ${this.formatErrorMessage(result.errors)}`
      );
    }

    return result.data;
  }

  async deleteMetaobjectDefinition(def) {
    this.logger.verbose(`Deleting metaobject definition: ${def.type}`);

    const result = await this.client.deleteMetaobjectDefinition(def.id);

    if (!result.success) {
      throw new Error(
        `Failed to delete metaobject definition ${
          def.type
        }: ${this.formatErrorMessage(result.errors)}`
      );
    }

    return result.data;
  }

  async copyDefinitionsWithDependencies(definitions, dryRun = false) {
    // Filter out reserved definitions
    const { filtered, skipped } = this.filterReservedDefinitions(definitions);

    const results = {
      metafields: { success: 0, errors: [] },
      metaobjects: { success: 0, errors: [] },
    };

    if (dryRun) {
      this.logger.dryRunInfo(
        `Would copy ${filtered.metafields.length} metafield definitions`
      );
      this.logger.dryRunInfo(
        `Would copy ${filtered.metaobjects.length} metaobject definitions`
      );
      return results;
    }

    // Track created metaobject IDs for reference mapping
    const metaobjectIdMapping = new Map();

    // Copy metaobject definitions first with multi-pass retry for dependencies
    let pendingMetaobjects = [...filtered.metaobjects];
    let pass = 0;

    while (pendingMetaobjects.length > 0 && pass < MAX_DEPENDENCY_PASSES) {
      pass++;
      this.logger.info(
        `Pass ${pass}: Attempting to copy ${pendingMetaobjects.length} metaobject definitions`
      );

      const stillPending = [];

      for (const def of pendingMetaobjects) {
        try {
          // Update metaobject references in this definition before creating
          const updatedDef = this.updateMetaobjectReferences(
            def,
            metaobjectIdMapping
          );
          const createdDefinition = await this.createMetaobjectDefinition(
            updatedDef
          );

          // Track the mapping from old ID to new ID
          metaobjectIdMapping.set(def.id, createdDefinition.id);
          results.metaobjects.success++;
          this.logger.info(`Successfully copied metaobject: ${def.type}`);

          // Add small delay to allow for propagation in Shopify
          await new Promise((resolve) =>
            setTimeout(resolve, CREATION_DELAY_MS)
          );
        } catch (error) {
          const isDependencyError = this.isDependencyError(error.message);

          if (isDependencyError && pass < MAX_DEPENDENCY_PASSES) {
            this.logger.warning(
              `Pass ${pass}: Metaobject ${def.type} depends on another metaobject, will retry in next pass`
            );
            stillPending.push(def);
          } else {
            results.metaobjects.errors.push({
              definition: def.type,
              error: error.message,
            });
            this.logger.error(
              `Failed to copy metaobject ${def.type}:`,
              error.message
            );
          }
        }
      }

      pendingMetaobjects = stillPending;

      // Add delay between passes to allow for propagation
      if (pendingMetaobjects.length > 0 && pass < MAX_DEPENDENCY_PASSES) {
        this.logger.info(
          `Waiting ${PASS_DELAY_MS / 1000} seconds before next pass...`
        );
        await new Promise((resolve) => setTimeout(resolve, PASS_DELAY_MS));
      }
    }

    // Report any remaining failures
    if (pendingMetaobjects.length > 0) {
      this.logger.error(
        `Failed to copy ${pendingMetaobjects.length} metaobject definitions after ${MAX_DEPENDENCY_PASSES} passes due to unresolved dependencies`
      );
      for (const def of pendingMetaobjects) {
        results.metaobjects.errors.push({
          definition: def.type,
          error:
            'Unresolved metaobject dependency after maximum retry attempts',
        });
      }
    }

    // Copy metafield definitions second (after metaobjects exist and can be referenced)
    const metafieldResults = await this.processDefinitions(
      { metafields: filtered.metafields, metaobjects: [] },
      {
        name: 'copy',
        metafield: async (def) => this.createMetafieldDefinition(def),
        metaobject: async () => {}, // No-op for this call
      }
    );
    results.metafields = metafieldResults.metafields;

    return results;
  }

  /**
   * Check if an error message indicates a dependency error
   */
  isDependencyError(errorMessage) {
    const lowerMessage = errorMessage.toLowerCase();
    return DEPENDENCY_ERROR_PATTERNS.some((pattern) =>
      lowerMessage.includes(pattern)
    );
  }

  // Helper method to update metaobject references with new IDs
  updateMetaobjectReferences(definition, idMapping) {
    const updatedDef = JSON.parse(JSON.stringify(definition)); // Deep clone

    updatedDef.fieldDefinitions = updatedDef.fieldDefinitions.map((field) => {
      // Check if this field has metaobject_reference validations
      if (field.validations && field.validations.length > 0) {
        field.validations = field.validations.map((validation) => {
          if (validation.name === METAOBJECT_REFERENCE_VALIDATION_KEY) {
            const oldId = validation.value;
            const newId = idMapping.get(oldId);

            if (newId) {
              this.logger.verbose(
                `Updating metaobject reference: ${oldId} -> ${newId}`
              );
              return { ...validation, value: newId };
            } else {
              this.logger.verbose(
                `No mapping found for metaobject ID: ${oldId}`
              );
            }
          }
          return validation;
        });
      }
      return field;
    });

    return updatedDef;
  }

  async deleteDefinitions(definitions, dryRun = false) {
    // Filter out reserved definitions
    const { filtered, skipped } = this.filterReservedDefinitions(definitions);

    return this.processDefinitions(
      filtered,
      {
        name: 'delete',
        metafield: async (def) => this.deleteMetafieldDefinition(def),
        metaobject: async (def) => this.deleteMetaobjectDefinition(def),
      },
      { dryRun }
    );
  }

  // Metaobject Entry Operations
  async getAllDefinitionsWithEntries(includeEntries = false) {
    const definitions = await this.getAllDefinitions();

    if (includeEntries) {
      // Add entry counts and optionally entries to metaobject definitions
      for (const metaobjectDef of definitions.metaobjects) {
        try {
          const entriesData =
            await this.client.getMetaobjectDefinitionWithEntriesCount(
              metaobjectDef.type
            );
          metaobjectDef.entriesCount =
            entriesData.metaobjectDefinitionByType?.metaobjectsCount || 0;

          // Fetch actual entries using the fixed query
          this.logger.verbose(
            `Fetching entries for metaobject type: ${metaobjectDef.type}`
          );
          metaobjectDef.entries = await this.getMetaobjectEntries(
            metaobjectDef.type
          );
          this.logger.verbose(
            `Found ${metaobjectDef.entries.length} entries for ${metaobjectDef.type}`
          );
        } catch (error) {
          this.logger.verbose(
            `Failed to get entry count for ${metaobjectDef.type}: ${error.message}`
          );
          metaobjectDef.entriesCount = 0;
          metaobjectDef.entries = [];
        }
      }
    }

    return definitions;
  }

  async getMetaobjectEntries(type) {
    const allEntries = [];
    let hasNextPage = true;
    let after = null;

    while (hasNextPage) {
      try {
        const response = await this.client.getMetaobjectEntries(
          type,
          250,
          after
        );
        const entriesData = response.metaobjects;

        allEntries.push(...entriesData.edges.map((edge) => edge.node));

        hasNextPage = entriesData.pageInfo.hasNextPage;
        after = entriesData.pageInfo.endCursor;
      } catch (error) {
        this.logger.error(
          `Failed to fetch entries for ${type}: ${error.message}`
        );
        break;
      }
    }

    return allEntries;
  }

  async copyMetaobjectEntries(
    sourceDefinitions,
    conflictResolver,
    dryRun = false
  ) {
    const results = {
      success: 0,
      errors: [],
      skipped: 0,
    };

    for (const metaobjectDef of sourceDefinitions.metaobjects || []) {
      try {
        this.logger.verbose(
          `Processing entries for metaobject type: ${metaobjectDef.type}`
        );

        // Get entries from the already-fetched data, or fetch if not available
        let sourceEntries;
        if (metaobjectDef.entries && Array.isArray(metaobjectDef.entries)) {
          // Use pre-fetched entries from source store
          sourceEntries = metaobjectDef.entries;
          this.logger.verbose(
            `Using pre-fetched entries for ${metaobjectDef.type}: ${sourceEntries.length} entries`
          );
        } else {
          // Fallback: fetch entries (this would fetch from target store, which is wrong for copying)
          this.logger.warning(
            `No pre-fetched entries found for ${metaobjectDef.type}, this may indicate a bug in entry fetching`
          );
          sourceEntries = await this.getMetaobjectEntries(metaobjectDef.type);
        }

        if (sourceEntries.length === 0) {
          this.logger.verbose(`No entries found for ${metaobjectDef.type}`);
          continue;
        }

        this.logger.info(
          `Copying ${sourceEntries.length} entries for ${metaobjectDef.type}`
        );

        // Process each entry
        for (const sourceEntry of sourceEntries) {
          try {
            const entryResult = await this.copyMetaobjectEntry(
              sourceEntry,
              conflictResolver,
              dryRun
            );

            if (entryResult.action === ENTRY_CONFLICT_ACTIONS.QUIT) {
              this.logger.info('Operation cancelled by user');
              return results;
            }

            if (entryResult.success) {
              results.success++;
            } else if (entryResult.skipped) {
              results.skipped++;
            } else {
              results.errors.push({
                type: 'metaobject_entry',
                identifier: `${sourceEntry.type}/${sourceEntry.handle}`,
                error: entryResult.error,
              });
            }
          } catch (error) {
            results.errors.push({
              type: 'metaobject_entry',
              identifier: `${sourceEntry.type}/${sourceEntry.handle}`,
              error: error.message,
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to process entries for ${metaobjectDef.type}: ${error.message}`
        );
        results.errors.push({
          type: 'metaobject_entries',
          identifier: metaobjectDef.type,
          error: error.message,
        });
      }
    }

    return results;
  }

  async copyMetaobjectEntry(sourceEntry, conflictResolver, dryRun = false) {
    const entryIdentifier = `${sourceEntry.type}/${sourceEntry.handle}`;

    if (dryRun) {
      this.logger.dryRunInfo(`Would copy entry: ${entryIdentifier}`);
      return { success: true, action: ENTRY_CONFLICT_ACTIONS.UPDATE };
    }

    try {
      // Check if entry exists in target
      const existingEntry = await this.client.getMetaobjectByHandle(
        sourceEntry.type,
        sourceEntry.handle
      );

      if (existingEntry.metaobjectByHandle) {
        // Conflict detected - ask user what to do
        const action = await conflictResolver.resolveConflict(
          sourceEntry,
          existingEntry.metaobjectByHandle,
          entryIdentifier
        );

        if (action === ENTRY_CONFLICT_ACTIONS.QUIT) {
          return { action: ENTRY_CONFLICT_ACTIONS.QUIT };
        }

        if (action === ENTRY_CONFLICT_ACTIONS.SKIP) {
          this.logger.verbose(`Skipped entry: ${entryIdentifier}`);
          return { skipped: true };
        }

        // Update existing entry
        const result = await this.client.upsertMetaobjectEntry(
          sourceEntry.type,
          sourceEntry.handle,
          sourceEntry.fields
        );

        if (!result.success) {
          throw new Error(
            `Upsert failed: ${this.formatErrorMessage(result.errors)}`
          );
        }

        this.logger.verbose(`Updated entry: ${entryIdentifier}`);
        return { success: true, action };
      } else {
        // Entry doesn't exist - create it
        const result = await this.client.createMetaobjectEntry(
          sourceEntry.type,
          sourceEntry.handle,
          sourceEntry.fields
        );

        if (!result.success) {
          throw new Error(
            `Create failed: ${this.formatErrorMessage(result.errors)}`
          );
        }

        this.logger.verbose(`Created entry: ${entryIdentifier}`);
        return { success: true, action: ENTRY_CONFLICT_ACTIONS.UPDATE };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteMetaobjectEntries(definitions, dryRun = false) {
    const results = {
      success: 0,
      errors: [],
    };

    for (const metaobjectDef of definitions.metaobjects || []) {
      try {
        this.logger.verbose(
          `Deleting entries for metaobject type: ${metaobjectDef.type}`
        );

        const entries = await this.getMetaobjectEntries(metaobjectDef.type);

        if (entries.length === 0) {
          this.logger.verbose(`No entries found for ${metaobjectDef.type}`);
          continue;
        }

        this.logger.info(
          `Deleting ${entries.length} entries for ${metaobjectDef.type}`
        );

        if (dryRun) {
          this.logger.dryRunInfo(
            `Would delete ${entries.length} entries for ${metaobjectDef.type}`
          );
          results.success += entries.length;
          continue;
        }

        for (const entry of entries) {
          try {
            const result = await this.client.deleteMetaobjectEntry(entry.id);

            if (result.metaobjectDelete.userErrors.length > 0) {
              throw new Error(
                `Delete failed: ${JSON.stringify(
                  result.metaobjectDelete.userErrors
                )}`
              );
            }

            results.success++;
            this.logger.verbose(`Deleted entry: ${entry.type}/${entry.handle}`);
          } catch (error) {
            results.errors.push({
              type: 'metaobject_entry',
              identifier: `${entry.type}/${entry.handle}`,
              error: error.message,
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to delete entries for ${metaobjectDef.type}: ${error.message}`
        );
        results.errors.push({
          type: 'metaobject_entries',
          identifier: metaobjectDef.type,
          error: error.message,
        });
      }
    }

    return results;
  }
}
