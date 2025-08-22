import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import { ConfirmationPrompt } from '../utils/confirmation.js';

const bulkCommand = new Command('bulk')
  .description(
    'Delete all definitions from target store and copy all from source store'
  )
  .requiredOption('--from <store>', 'Source store name (e.g., staging)')
  .requiredOption('--to <store>', 'Target store name (e.g., production)')
  .option('--yes', 'Skip confirmation prompt (use with caution!)')
  .action(async (options, command) => {
    const handler = new CommandHandler(
      'Bulk Sync',
      options,
      command.parent.opts()
    );

    await handler.execute(async (ctx) => {
      // Create clients for both stores
      const clients = ctx.createClients([options.from, options.to]);
      const sourceManager = ctx.createManager(clients[options.from]);
      const targetManager = ctx.createManager(clients[options.to]);

      // Fetch definitions from both stores
      ctx.logger.info(
        `Fetching definitions from source store (${options.from})...`
      );
      const {
        metafields: sourceMetafieldDefs,
        metaobjects: sourceMetaobjectDefs,
      } = await sourceManager.getAllDefinitions();

      ctx.logger.info(
        `Fetching definitions from target store (${options.to})...`
      );
      const {
        metafields: targetMetafieldDefs,
        metaobjects: targetMetaobjectDefs,
      } = await targetManager.getAllDefinitions();

      // Filter reserved definitions from source
      const filteredSourceDefinitions = ctx.filterReservedDefinitions(
        sourceManager,
        {
          metafields: sourceMetafieldDefs,
          metaobjects: sourceMetaobjectDefs,
        },
        'copy'
      );

      // Filter reserved definitions from target for deletion
      const filteredTargetDefinitions = ctx.filterReservedDefinitions(
        targetManager,
        {
          metafields: targetMetafieldDefs,
          metaobjects: targetMetaobjectDefs,
        },
        'delete'
      );

      // Exit if no definitions to process
      if (!filteredSourceDefinitions || !filteredTargetDefinitions) {
        return;
      }

      ctx.logger.info('Current state (after filtering):', {
        source: {
          metafields: filteredSourceDefinitions.metafields.length,
          metaobjects: filteredSourceDefinitions.metaobjects.length,
        },
        target: {
          metafields: filteredTargetDefinitions.metafields.length,
          metaobjects: filteredTargetDefinitions.metaobjects.length,
        },
      });

      if (ctx.globalOpts.dryRun) {
        ctx.logger.dryRunInfo('DRY RUN - No actual changes will be made');
        ctx.logger.dryRunInfo(
          `Would delete ${filteredTargetDefinitions.metafields.length} metafield definitions from ${options.to}`
        );
        ctx.logger.dryRunInfo(
          `Would delete ${filteredTargetDefinitions.metaobjects.length} metaobject definitions from ${options.to}`
        );
        ctx.logger.dryRunInfo(
          `Would copy ${filteredSourceDefinitions.metaobjects.length} metaobject definitions from ${options.from} (with dependency resolution)`
        );
        ctx.logger.dryRunInfo(
          `Would copy ${filteredSourceDefinitions.metafields.length} metafield definitions from ${options.from}`
        );
        return;
      }

      // Interactive confirmation before proceeding with destructive bulk operation
      const confirmed = await ConfirmationPrompt.confirm({
        operation: 'Bulk Sync (Delete All + Copy All)',
        target: `${options.to} store`,
        impact: {
          metafields:
            filteredTargetDefinitions.metafields.length +
            filteredSourceDefinitions.metafields.length,
          metaobjects:
            filteredTargetDefinitions.metaobjects.length +
            filteredSourceDefinitions.metaobjects.length,
        },
        details: [
          `Will DELETE ${
            filteredTargetDefinitions.metafields.length +
            filteredTargetDefinitions.metaobjects.length
          } definitions from ${options.to}`,
          `Will COPY ${
            filteredSourceDefinitions.metafields.length +
            filteredSourceDefinitions.metaobjects.length
          } definitions from ${options.from}`,
          'This completely replaces the target store definitions',
        ],
        skipConfirmation: options.yes,
      });

      if (!confirmed) {
        ctx.logger.info('Bulk sync operation cancelled by user.');
        return;
      }

      // Phase 1: Delete all from target
      if (
        filteredTargetDefinitions.metafields.length > 0 ||
        filteredTargetDefinitions.metaobjects.length > 0
      ) {
        ctx.logger.info('Deleting all definitions from target store...');
        const deleteResults = await targetManager.deleteDefinitions(
          filteredTargetDefinitions
        );

        ctx.logger.info('Deleted definitions:', {
          metafields: deleteResults.metafields.success,
          metaobjects: deleteResults.metaobjects.success,
          errors:
            deleteResults.metafields.errors.length +
            deleteResults.metaobjects.errors.length,
        });
      }

      // Phase 2: Copy all from source (with dependency resolution)
      ctx.logger.info('Copying all definitions from source to target...');
      const copyResults = await targetManager.copyDefinitionsWithDependencies(
        filteredSourceDefinitions
      );

      const totalCopied =
        copyResults.metafields.success + copyResults.metaobjects.success;
      const totalErrors =
        copyResults.metafields.errors.length +
        copyResults.metaobjects.errors.length;

      if (totalErrors > 0) {
        ctx.logger.warning(
          `Operation completed with ${totalErrors} errors. Check logs for details.`
        );
      }

      return {
        copied: {
          metafields: copyResults.metafields.success,
          metaobjects: copyResults.metaobjects.success,
          total: totalCopied,
        },
        deleted: {
          metafields: filteredTargetDefinitions.metafields.length,
          metaobjects: filteredTargetDefinitions.metaobjects.length,
        },
        errors: totalErrors,
      };
    });
  });

export { bulkCommand };
