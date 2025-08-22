import { createShopifyClient, validateStoreNames } from './config.js';
import { createLogger } from './logger.js';
import { DefinitionManager } from '../managers/definition.js';
import {
  isReservedMetafieldNamespace,
  isReservedMetaobjectType,
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
}
