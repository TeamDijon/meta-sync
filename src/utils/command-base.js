import {
  createShopifyClient,
  validateStoreNames,
  getConfigManager,
  getDefaults,
  getEnvironment,
} from './config.js';
import { createLogger } from './logger.js';
import { DefinitionManager } from '../managers/definition.js';
import {
  isReservedMetafieldNamespace,
  isReservedMetaobjectType,
  filterDefinitionsByResourceType,
} from './constants.js';

/**
 * Base command handler that provides common functionality for all commands
 */
export class CommandHandler {
  constructor(operationNameOrGlobalOpts, options, globalOpts) {
    // Support both old and new constructor patterns
    if (typeof operationNameOrGlobalOpts === 'string') {
      // Old pattern: CommandHandler(operationName, options, globalOpts)
      this.operationName = operationNameOrGlobalOpts;
      this.options = options;
      this.globalOpts = globalOpts;
    } else {
      // New pattern: CommandHandler(globalOpts)
      this.globalOpts = operationNameOrGlobalOpts || {};
    }

    this.logger = createLogger({
      verbose: this.globalOpts.verbose,
      logFile: this.globalOpts.log,
      dryRun: this.globalOpts.dryRun,
    });

    // Store configuration manager instance
    this.configManager = getConfigManager();
  }

  /**
   * Get configuration defaults
   */
  getDefaults() {
    return getDefaults();
  }

  /**
   * Get environment information
   */
  getEnvironment() {
    return getEnvironment();
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary() {
    return this.configManager.getConfigSummary();
  }

  /**
   * Create Shopify client with enhanced error handling
   */
  createShopifyClient(storeName, options = {}) {
    try {
      const client = createShopifyClient(storeName);

      if (this.getEnvironment().debug) {
        this.logger.debug(`Created Shopify client for store: ${storeName}`, {
          storeName,
          hasClient: !!client,
          options,
        });
      }

      return client;
    } catch (error) {
      this.logger.error(
        `Failed to create Shopify client for store '${storeName}':`,
        error.message
      );

      // Provide helpful configuration information
      const summary = this.getConfigSummary();
      this.logger.info('Available stores:', summary.stores);

      throw error;
    }
  }

  /**
   * Validate store names with enhanced error reporting
   */
  validateStoreNames(storeNames, context = 'operation') {
    try {
      return validateStoreNames(storeNames);
    } catch (error) {
      this.logger.error(
        `Store validation failed for ${context}:`,
        error.message
      );

      // Provide helpful configuration information
      const summary = this.getConfigSummary();
      this.logger.info('Configuration summary:', summary);

      throw error;
    }
  }

  /**
   * Filter reserved definitions with consistent logging
   * @param {Object} manager - The DefinitionManager instance
   * @param {Object} definitions - The definitions to filter
   * @param {string} operation - Operation name for logging context
   * @returns {Object} - The filtered definitions or null if empty
   */
  filterReservedDefinitions(manager, definitions, operation = 'process') {
    this.logger.info('Filtering reserved Shopify definitions...');
    const { filtered, skipped } =
      manager.filterReservedDefinitions(definitions);

    // Check if we have any definitions left after filtering
    if (filtered.metafields.length === 0 && filtered.metaobjects.length === 0) {
      this.logger.warning(`No definitions to ${operation}!`);
      return null;
    }

    return filtered;
  }

  /**
   * Check if definitions object is empty
   * @param {Object} definitions - The definitions object
   * @param {string} operation - Operation name for warning message
   * @returns {boolean} - True if empty
   */
  isDefinitionsEmpty(definitions, operation = 'process') {
    const isEmpty =
      definitions.metafields.length === 0 &&
      definitions.metaobjects.length === 0;
    if (isEmpty) {
      this.logger.warning(`No definitions to ${operation}!`);
    }
    return isEmpty;
  }

  /**
   * Count reserved definitions in a definitions object
   * @param {Object} definitions - Object with metafields and metaobjects arrays
   * @returns {Object} - Counts of reserved definitions
   */
  countReservedDefinitions(definitions) {
    const reservedMetafields = (definitions.metafields || []).filter((def) =>
      isReservedMetafieldNamespace(def.namespace)
    );
    const reservedMetaobjects = (definitions.metaobjects || []).filter((def) =>
      isReservedMetaobjectType(def.type)
    );

    return {
      metafields: reservedMetafields,
      metaobjects: reservedMetaobjects,
      counts: {
        metafields: reservedMetafields.length,
        metaobjects: reservedMetaobjects.length,
        total: reservedMetafields.length + reservedMetaobjects.length,
      },
    };
  }

  // New pattern: for class-based commands
  async run(options) {
    try {
      await this.execute(options);
    } catch (error) {
      this.logger.error(`Operation failed`, {
        error: error.message,
      });
      process.exit(1);
    }
  }

  // Old pattern: for functional-style commands
  async execute(handler) {
    if (typeof handler === 'function') {
      // Old pattern: handler is a function
      const startTime = this.logger.startOperation(this.operationName, {
        ...this.options,
        dryRun: this.globalOpts.dryRun,
      });

      try {
        const result = await handler(this);

        if (result) {
          this.logger.endOperation(this.operationName, startTime, result);
        }
      } catch (error) {
        this.logger.error(`${this.operationName} failed`, {
          error: error.message,
        });
        process.exit(1);
      }
    } else {
      // New pattern: this.execute should be overridden by subclass
      throw new Error('execute method should be implemented by subclass');
    }
  }

  createClients(storeNamesOrSingleStore) {
    if (Array.isArray(storeNamesOrSingleStore)) {
      // Old pattern: array of store names
      validateStoreNames(storeNamesOrSingleStore);
      const clients = {};
      storeNamesOrSingleStore.forEach((storeName) => {
        clients[storeName] = createShopifyClient(storeName);
      });
      this.logger.verbose('Connected to stores', {
        stores: storeNamesOrSingleStore,
      });
      return clients;
    } else {
      // New pattern: single store name
      validateStoreNames([storeNamesOrSingleStore]);
      const client = createShopifyClient(storeNamesOrSingleStore);
      const manager = new DefinitionManager(client, this.logger);
      return { client, manager };
    }
  }

  createManager(client) {
    return new DefinitionManager(client, this.logger);
  }

  /**
   * Common operation: Fetch definitions with optional entries and resource filtering
   * @param {DefinitionManager} manager - The definition manager instance
   * @param {Object} options - Options including includeEntries and resources
   * @returns {Object} - Filtered definitions
   */
  async fetchAndFilterDefinitions(manager, options = {}) {
    const { includeEntries = false, resources = 'both' } = options;

    this.logger.info('Fetching definitions from store...');
    const allDefinitions = includeEntries
      ? await manager.getAllDefinitionsWithEntries()
      : await manager.getAllDefinitions();

    this.logger.verbose('Applying resource type filtering...');
    return filterDefinitionsByResourceType(allDefinitions, resources);
  }

  /**
   * Common operation: Standard definition processing flow
   * @param {DefinitionManager} manager - The definition manager instance
   * @param {Object} definitions - Raw definitions to process
   * @param {Object} options - Processing options
   * @returns {Object} - Processed definitions ready for operations
   */
  async prepareDefinitionsForOperation(manager, definitions, options = {}) {
    const { resources = 'both', operation = 'process' } = options;

    // Apply resource filtering
    const resourceFiltered = filterDefinitionsByResourceType(
      definitions,
      resources
    );

    // Filter reserved definitions
    const processed = this.filterReservedDefinitions(
      manager,
      resourceFiltered,
      operation
    );

    if (!processed) {
      throw new Error(`No definitions available to ${operation}`);
    }

    return processed;
  }

  /**
   * Common operation: Handle entry operations with proper logging
   * @param {DefinitionManager} manager - The definition manager instance
   * @param {Object} definitions - Definitions with potential entries
   * @param {Object} options - Entry operation options
   * @returns {Object} - Entry operation results
   */
  async handleEntryOperations(manager, definitions, options = {}) {
    const {
      includeEntries = false,
      operation = 'process',
      dryRun = false,
      ...operationOptions
    } = options;

    if (
      !includeEntries ||
      !definitions.metaobjects ||
      definitions.metaobjects.length === 0
    ) {
      return null;
    }

    const entryCount = definitions.metaobjects.reduce(
      (sum, def) => sum + (def.entries ? def.entries.length : 0),
      0
    );

    if (entryCount === 0) {
      this.logger.info('No metaobject entries found to process');
      return null;
    }

    this.logger.info(`Processing ${entryCount} metaobject entries...`);

    if (dryRun) {
      this.logger.dryRunInfo(`Would ${operation} ${entryCount} entries`);
      return { success: entryCount, errors: [] };
    }

    // Delegate to specific entry operation
    switch (operation) {
      case 'copy':
        return await manager.copyMetaobjectEntries(
          definitions.metaobjects,
          operationOptions
        );
      case 'delete':
        return await manager.deleteMetaobjectEntries(definitions, dryRun);
      default:
        throw new Error(`Unknown entry operation: ${operation}`);
    }
  }

  /**
   * Common operation: Log definition summary with entry counts
   * @param {Object} definitions - Definitions to summarize
   * @param {Object} options - Logging options
   */
  logDefinitionSummary(definitions, options = {}) {
    const {
      includeEntries = false,
      operation = 'process',
      verbose = false,
    } = options;

    const total =
      definitions.metafields.length + definitions.metaobjects.length;
    this.logger.info(`Preparing to ${operation} ${total} definitions:`);

    if (definitions.metafields.length > 0) {
      this.logger.info(`  Metafields: ${definitions.metafields.length}`);
      if (verbose) {
        definitions.metafields.forEach((def) => {
          this.logger.verbose(
            `    - ${def.namespace}.${def.key} (${def.name})`
          );
        });
      }
    }

    if (definitions.metaobjects.length > 0) {
      this.logger.info(`  Metaobjects: ${definitions.metaobjects.length}`);
      if (verbose) {
        definitions.metaobjects.forEach((def) => {
          const entryInfo =
            includeEntries && def.entries
              ? ` [${def.entries.length} entries]`
              : '';
          this.logger.verbose(`    - ${def.type} (${def.name})${entryInfo}`);
        });
      }
    }
  }
}
