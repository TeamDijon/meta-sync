import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import {
  COMMON_OPTIONS,
  createCommandAction,
} from '../utils/command-options.js';
import { ManifestParser } from '../utils/manifest.js';
import { ConfirmationPrompt } from '../utils/confirmation.js';

class DeleteCommand extends CommandHandler {
  async execute(options) {
    const { store, manifest, resources, includeEntries } = options;

    const startTime = this.logger.startOperation('Delete Definitions', {
      store,
      manifest,
      resources,
      includeEntries,
      dryRun: this.globalOpts.dryRun,
    });

    // Create client and manager
    // Create client and manager
    const { client, manager } = this.createClients(store);
    this.logger.verbose('Connected to store');

    let definitionsToDelete;

    if (manifest) {
      // Manifest-based deletion
      this.logger.info(`Parsing manifest file: ${manifest}`);
      const manifestDefs = ManifestParser.parseFile(manifest);

      const allDefinitions = await this.fetchAndFilterDefinitions(manager, {
        includeEntries,
        resources,
      });

      const matches = ManifestParser.findMatchingDefinitions(
        manifestDefs,
        allDefinitions
      );

      if (matches.notFound.length > 0) {
        this.logger.warning(
          'Some definitions from manifest were not found in store:'
        );
        matches.notFound.forEach((def) => {
          this.logger.warning(`  - ${def.type}: ${def.identifier}`);
        });
      }

      definitionsToDelete = {
        metafields: matches.metafields,
        metaobjects: matches.metaobjects,
      };
    } else {
      // Delete ALL definitions
      this.logger.warning(
        'Will delete ALL definitions (filtered by resource type)'
      );
      this.logger.warning(
        'This is a DESTRUCTIVE operation that will remove all matching definitions!'
      );

      definitionsToDelete = await this.fetchAndFilterDefinitions(manager, {
        includeEntries,
        resources,
      });
    }

    // Prepare definitions for deletion
    definitionsToDelete = await this.prepareDefinitionsForOperation(
      manager,
      definitionsToDelete,
      { operation: 'delete' }
    );

    // Log summary using base class method
    this.logDefinitionSummary(definitionsToDelete, {
      includeEntries,
      operation: 'delete',
      verbose: this.logger.isVerbose,
    });

    if (this.globalOpts.dryRun) {
      this.logger.dryRunInfo('DRY RUN - No actual deletions will be performed');

      // Show entry deletion info in dry run
      if (includeEntries) {
        const entryCount = definitionsToDelete.metaobjects.reduce(
          (sum, def) => sum + (def.entries ? def.entries.length : 0),
          0
        );
        if (entryCount > 0) {
          this.logger.dryRunInfo(
            `Would also delete ${entryCount} metaobject entries`
          );
        }
      }

      return;
    }

    // Calculate entry count for confirmation
    let totalEntries = 0;
    if (includeEntries) {
      totalEntries = definitionsToDelete.metaobjects.reduce(
        (sum, def) => sum + (def.entries ? def.entries.length : 0),
        0
      );
    }

    // Interactive confirmation before proceeding with destructive operation
    const details = [];
    if (!manifest) {
      details.push('ALL definitions will be deleted (no manifest specified)');
    } else {
      details.push(`Definitions specified in manifest: ${manifest}`);
    }

    if (includeEntries && totalEntries > 0) {
      details.push(`${totalEntries} metaobject entries will also be deleted`);
    }

    const confirmed = await ConfirmationPrompt.confirm({
      operation: 'Delete Definitions',
      target: `${store} store`,
      impact: {
        metafields: definitionsToDelete.metafields.length,
        metaobjects: definitionsToDelete.metaobjects.length,
      },
      details,
      skipConfirmation: options.yes, // Skip if --yes flag provided
    });

    if (!confirmed) {
      this.logger.info('Operation cancelled by user.');
      return;
    }

    // Perform deletions
    this.logger.info('Deleting definitions...');

    // Delete entries first if requested
    let entryDeletionResults = null;
    if (includeEntries && definitionsToDelete.metaobjects.length > 0) {
      this.logger.info('Deleting metaobject entries first...');
      entryDeletionResults = await manager.deleteMetaobjectEntries(
        definitionsToDelete
      );

      const entriesDeleted = entryDeletionResults.success;
      const entryErrors = entryDeletionResults.errors.length;

      this.logger.info(
        `Deleted ${entriesDeleted} entries${
          entryErrors > 0 ? ` with ${entryErrors} errors` : ''
        }`
      );
    }

    // Then delete definitions
    const deleteResults = await manager.deleteDefinitions(definitionsToDelete);

    const totalSuccess =
      deleteResults.metafields.success + deleteResults.metaobjects.success;
    const totalErrors =
      deleteResults.metafields.errors.length +
      deleteResults.metaobjects.errors.length;

    this.logger.endOperation('Delete Definitions', startTime, {
      deleted: {
        metafields: deleteResults.metafields.success,
        metaobjects: deleteResults.metaobjects.success,
        total: totalSuccess,
      },
      errors: totalErrors,
    });

    if (totalErrors > 0) {
      this.logger.warning(
        `Operation completed with ${totalErrors} errors. Check logs for details.`
      );
    }
  }
}

const deleteCommand = COMMON_OPTIONS.withStandardOptions(
  COMMON_OPTIONS.withManifest(
    new Command('delete')
      .description('Delete metafield and metaobject definitions from a store')
      .requiredOption('--store <store>', 'Target store name')
  )
).action(createCommandAction(DeleteCommand));

export { deleteCommand, DeleteCommand };
