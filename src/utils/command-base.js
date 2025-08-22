import { createShopifyClient, validateStoreNames } from './config.js';
import { createLogger } from './logger.js';
import { DefinitionManager } from '../managers/definition.js';

/**
 * Base command handler that provides common functionality for all commands
 */
export class CommandHandler {
  constructor(globalOpts) {
    this.globalOpts = globalOpts || {};

    this.logger = createLogger({
      verbose: this.globalOpts.verbose,
      logFile: this.globalOpts.log,
      dryRun: this.globalOpts.dryRun,
    });
  }

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

  createClients(storeName) {
    validateStoreNames([storeName]);
    const client = createShopifyClient(storeName);
    const manager = new DefinitionManager(client, this.logger);
    return { client, manager };
  }

  createManager(client) {
    return new DefinitionManager(client, this.logger);
  }
}
