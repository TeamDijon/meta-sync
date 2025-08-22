import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import { ManifestParser } from '../utils/manifest.js';

class DeleteCommand extends CommandHandler {
  async execute(options) {
    const { store, manifest } = options;

    const startTime = this.logger.startOperation('Delete Definitions', {
      store,
      manifest,
      dryRun: this.globalOpts.dryRun,
    });

    // Create client and manager
    const { client, manager } = this.createClients(store);

    this.logger.verbose('Connected to store');

    // Get all definitions from store
    this.logger.info(`Fetching definitions from store (${store})...`);
    const allDefinitions = await manager.getAllDefinitions();

    let definitionsToDelete;

    if (manifest) {
      // Parse manifest and find matching definitions
      this.logger.info(`Parsing manifest file: ${manifest}`);
      const manifestDefs = ManifestParser.parseFile(manifest);

      this.logger.verbose('Parsed manifest:', {
        metafields: manifestDefs.metafields.length,
        metaobjects: manifestDefs.metaobjects.length,
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

      this.logger.info('Matched definitions from manifest:', {
        metafields: matches.metafields.length,
        metaobjects: matches.metaobjects.length,
      });
    } else {
      // Delete ALL definitions (dangerous!)
      definitionsToDelete = allDefinitions;
      this.logger.warning('Will delete ALL definitions:', {
        metafields: allDefinitions.metafields.length,
        metaobjects: allDefinitions.metaobjects.length,
      });
      this.logger.warning(
        'This is a DESTRUCTIVE operation that will remove all definitions!'
      );
    }

    if (
      definitionsToDelete.metafields.length === 0 &&
      definitionsToDelete.metaobjects.length === 0
    ) {
      this.logger.warning('No definitions to delete!');
      return;
    }

    // Show what will be deleted
    const totalToDelete =
      definitionsToDelete.metafields.length +
      definitionsToDelete.metaobjects.length;

    this.logger.info(`Preparing to delete ${totalToDelete} definitions:`);

    if (definitionsToDelete.metafields.length > 0) {
      this.logger.info(
        `  Metafields: ${definitionsToDelete.metafields.length}`
      );
      if (this.logger.isVerbose) {
        definitionsToDelete.metafields.forEach((def) => {
          this.logger.verbose(
            `    - ${def.namespace}.${def.key} (${def.name})`
          );
        });
      }
    }

    if (definitionsToDelete.metaobjects.length > 0) {
      this.logger.info(
        `  Metaobjects: ${definitionsToDelete.metaobjects.length}`
      );
      if (this.logger.isVerbose) {
        definitionsToDelete.metaobjects.forEach((def) => {
          this.logger.verbose(`    - ${def.type} (${def.name})`);
        });
      }
    }

    if (this.globalOpts.dryRun) {
      this.logger.dryRunInfo('DRY RUN - No actual deletions will be performed');
      return;
    }

    if (!manifest) {
      this.logger.warning(
        '⚠️  WARNING: You are about to delete ALL definitions from the store!'
      );
      this.logger.warning('⚠️  This action cannot be undone!');
      // TODO: Add interactive confirmation in future
    }

    // Perform deletions
    this.logger.info('Deleting definitions...');
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

const deleteCommand = new Command('delete')
  .description('Delete metafield and metaobject definitions from a store')
  .requiredOption('--store <store>', 'Target store name')
  .option(
    '--manifest <file>',
    'Manifest file specifying which definitions to delete'
  )
  .action(async (options, command) => {
    const handler = new DeleteCommand(command.parent.opts());
    await handler.run(options);
  });

export { deleteCommand };
