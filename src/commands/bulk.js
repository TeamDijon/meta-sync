import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import {
  COMMON_OPTIONS,
  createCommandAction,
} from '../utils/command-options.js';
import { ConfirmationPrompt } from '../utils/confirmation.js';
import { EntryConflictResolver } from '../utils/entry-conflict.js';
import { validateStoreNames, createShopifyClient } from '../utils/config.js';
import { DefinitionManager } from '../managers/definition.js';

class BulkCommand extends CommandHandler {
  async execute(options) {
    const { from, to, resources, includeEntries, yes } = options;

    const startTime = this.logger.startOperation('Bulk Sync', {
      from,
      to,
      resources,
      includeEntries,
      dryRun: this.globalOpts.dryRun,
    });

    // Create clients for both stores
    validateStoreNames([from, to]);
    const sourceClient = createShopifyClient(from);
    const targetClient = createShopifyClient(to);
    const sourceManager = new DefinitionManager(sourceClient, this.logger);
    const targetManager = new DefinitionManager(targetClient, this.logger);

    // Fetch definitions from both stores
    this.logger.info(`Fetching definitions from source store (${from})...`);
    const sourceDefinitions = await this.fetchAndFilterDefinitions(
      sourceManager,
      {
        includeEntries,
        resources,
      }
    );

    this.logger.info(`Fetching definitions from target store (${to})...`);
    const targetDefinitions = await this.fetchAndFilterDefinitions(
      targetManager,
      {
        includeEntries: false, // Don't need entries for deletion
        resources,
      }
    );

    // Prepare definitions for operations
    const sourceFiltered = await this.prepareDefinitionsForOperation(
      sourceManager,
      sourceDefinitions,
      { operation: 'copy' }
    );

    // For target (delete), handle empty stores gracefully
    let targetFiltered = { metafields: [], metaobjects: [] };
    try {
      targetFiltered = await this.prepareDefinitionsForOperation(
        targetManager,
        targetDefinitions,
        { operation: 'delete' }
      );
    } catch (error) {
      if (error.message.includes('No definitions available to delete')) {
        this.logger.info('Target store is empty - no definitions to delete');
        targetFiltered = { metafields: [], metaobjects: [] };
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Calculate counts
    const sourceTotal =
      sourceFiltered.metafields.length + sourceFiltered.metaobjects.length;
    const targetTotal =
      targetFiltered.metafields.length + targetFiltered.metaobjects.length;

    this.logger.info('Bulk sync summary:', {
      source: {
        store: from,
        metafields: sourceFiltered.metafields.length,
        metaobjects: sourceFiltered.metaobjects.length,
        total: sourceTotal,
      },
      target: {
        store: to,
        metafields: targetFiltered.metafields.length,
        metaobjects: targetFiltered.metaobjects.length,
        total: targetTotal,
      },
      resources,
    });

    // Calculate entry counts if requested
    let sourceEntryCount = 0;
    let targetEntryCount = 0;
    if (includeEntries) {
      sourceEntryCount = sourceFiltered.metaobjects.reduce(
        (sum, def) => sum + (def.entries ? def.entries.length : 0),
        0
      );
      targetEntryCount = targetFiltered.metaobjects.reduce(
        (sum, def) => sum + (def.entries ? def.entries.length : 0),
        0
      );

      this.logger.info('Entry counts:', {
        source: sourceEntryCount,
        target: targetEntryCount,
      });
    }

    if (this.globalOpts.dryRun) {
      this.logger.dryRunInfo('DRY RUN - No actual changes will be made');
      this.logger.dryRunInfo(
        `Would delete ${targetTotal} definitions from target`
      );
      this.logger.dryRunInfo(`Would copy ${sourceTotal} definitions to target`);
      if (includeEntries) {
        this.logger.dryRunInfo(
          `Would delete ${targetEntryCount} entries from target`
        );
        this.logger.dryRunInfo(
          `Would copy ${sourceEntryCount} entries to target`
        );
      }
      return;
    }

    // Confirmation prompt
    const details = [
      `All ${targetTotal} definitions in ${to} will be DELETED`,
      `All ${sourceTotal} definitions from ${from} will be COPIED`,
    ];

    if (includeEntries && (targetEntryCount > 0 || sourceEntryCount > 0)) {
      details.push(
        `${targetEntryCount} entries will be deleted, ${sourceEntryCount} entries will be copied`
      );
    }

    const confirmed = await ConfirmationPrompt.confirm({
      operation: 'Bulk Sync (DESTRUCTIVE)',
      target: `${from} → ${to}`,
      impact: {
        delete: targetTotal,
        copy: sourceTotal,
        entries: includeEntries
          ? { delete: targetEntryCount, copy: sourceEntryCount }
          : null,
      },
      details,
      skipConfirmation: yes,
    });

    if (!confirmed) {
      this.logger.info('Operation cancelled by user.');
      return;
    }

    let entryDeleteResults = null;
    let entryCopyResults = null;

    // Step 1: Delete entries from target if requested
    if (includeEntries && targetEntryCount > 0) {
      this.logger.info('Deleting metaobject entries from target store...');
      entryDeleteResults = await this.handleEntryOperations(
        targetManager,
        targetFiltered,
        {
          includeEntries: true,
          operation: 'delete',
          dryRun: this.globalOpts.dryRun,
        }
      );
    }

    // Step 2: Delete all definitions from target
    this.logger.info('Deleting all definitions from target store...');
    const deleteResults = await targetManager.deleteDefinitions(targetFiltered);

    // Step 3: Copy all definitions from source to target
    this.logger.info('Copying all definitions from source to target...');
    const copyResults = await sourceManager.copyDefinitionsWithDependencies(
      sourceFiltered
    );

    // Step 4: Copy entries if requested
    if (includeEntries && sourceEntryCount > 0) {
      this.logger.info('Copying metaobject entries from source to target...');

      const entryConflictResolver = new EntryConflictResolver(
        this.logger,
        this.globalOpts.dryRun
      );

      entryCopyResults = await targetManager.copyMetaobjectEntries(
        sourceFiltered,
        entryConflictResolver,
        this.globalOpts.dryRun
      );
    }

    // Summary
    const totalDeleted =
      deleteResults.metafields.success + deleteResults.metaobjects.success;
    const totalCopied =
      copyResults.metafields.success + copyResults.metaobjects.success;
    const totalErrors =
      deleteResults.metafields.errors.length +
      deleteResults.metaobjects.errors.length +
      copyResults.metafields.errors.length +
      copyResults.metaobjects.errors.length;

    this.logger.endOperation('Bulk Sync', startTime, {
      deleted: {
        metafields: deleteResults.metafields.success,
        metaobjects: deleteResults.metaobjects.success,
        entries: entryDeleteResults ? entryDeleteResults.success : 0,
        total: totalDeleted,
      },
      copied: {
        metafields: copyResults.metafields.success,
        metaobjects: copyResults.metaobjects.success,
        entries: entryCopyResults ? entryCopyResults.success : 0,
        total: totalCopied,
      },
      errors:
        totalErrors +
        (entryDeleteResults ? entryDeleteResults.errors.length : 0) +
        (entryCopyResults ? entryCopyResults.errors.length : 0),
    });

    if (totalErrors > 0) {
      this.logger.warning(
        `Operation completed with ${totalErrors} errors. Check logs for details.`
      );
    } else {
      this.logger.success('Bulk sync completed successfully!');
    }
  }
}

// Create command with standardized options
const bulkCommand = COMMON_OPTIONS.withStandardOptions(
  new Command('bulk')
    .description(
      'Delete all definitions from target store and copy all from source store'
    )
    .requiredOption('--from <store>', 'Source store name (e.g., staging)')
    .requiredOption('--to <store>', 'Target store name (e.g., production)')
).action(createCommandAction(BulkCommand));

export { bulkCommand };
