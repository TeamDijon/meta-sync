import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import {
  COMMON_OPTIONS,
  createCommandAction,
} from '../utils/command-options.js';
import { DeleteCommand } from './delete.js';
import { CopyCommand } from './copy.js';

class BulkCommand extends CommandHandler {
  async execute(options) {
    const { from, to, resources, includeEntries, yes, manifest } = options;

    const startTime = this.logger.startOperation('Bulk Sync', {
      from,
      to,
      resources,
      includeEntries,
      manifest,
      dryRun: this.globalOpts.dryRun,
    });

    this.logger.info('Starting bulk operation: delete followed by copy');
    this.logger.info(`Source store: ${from}`);
    this.logger.info(`Target store: ${to}`);

    try {
      // Step 1: Execute delete command on target store
      this.logger.info(
        `Step 1: Deleting definitions from target store (${to})...`
      );
      const deleteCommand = new DeleteCommand(this.globalOpts);

      const deleteOptions = {
        store: to, // Map --to parameter to --store for delete command
        resources,
        includeEntries,
        yes,
        manifest,
      };

      try {
        await deleteCommand.execute(deleteOptions);
      } catch (error) {
        // Handle case where there are no definitions to delete gracefully
        if (error.message.includes('No definitions available to delete')) {
          this.logger.info(
            'Target store is empty - no definitions to delete, continuing with copy...'
          );
        } else {
          throw error; // Re-throw other errors
        }
      }

      // Step 2: Execute copy command from source to target
      this.logger.info(
        `Step 2: Copying definitions from source (${from}) to target (${to})...`
      );
      const copyCommand = new CopyCommand(this.globalOpts);

      const copyOptions = {
        from,
        to,
        resources,
        includeEntries,
        yes,
        manifest,
      };

      try {
        await copyCommand.execute(copyOptions);
      } catch (error) {
        // Handle case where there are no definitions to copy gracefully
        if (error.message.includes('No definitions available to copy')) {
          this.logger.info(
            'Source store has no definitions to copy - bulk operation completed.'
          );
        } else {
          throw error; // Re-throw other errors
        }
      }

      this.logger.endOperation('Bulk Sync', startTime, {
        message: 'Bulk sync completed successfully!',
      });

      this.logger.success('Bulk sync completed successfully!');
    } catch (error) {
      this.logger.endOperation('Bulk Sync', startTime, {
        error: error.message,
      });

      this.logger.error('Bulk sync failed:', error.message);
      throw error;
    }
  }
}

// Create command with standardized options
const bulkCommand = COMMON_OPTIONS.withStandardOptions(
  COMMON_OPTIONS.withManifest(
    new Command('bulk')
      .description(
        'Delete all definitions from target store and copy all from source store (executes delete then copy commands)'
      )
      .requiredOption('--from <store>', 'Source store name (e.g., staging)')
      .requiredOption('--to <store>', 'Target store name (e.g., production)')
  )
).action(createCommandAction(BulkCommand));

export { bulkCommand };
