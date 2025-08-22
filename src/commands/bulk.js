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

      ctx.logger.info('Current state:', {
        source: {
          metafields: sourceMetafieldDefs.length,
          metaobjects: sourceMetaobjectDefs.length,
        },
        target: {
          metafields: targetMetafieldDefs.length,
          metaobjects: targetMetaobjectDefs.length,
        },
      });

      if (ctx.globalOpts.dryRun) {
        ctx.logger.dryRunInfo('DRY RUN - No actual changes will be made');
        ctx.logger.dryRunInfo(
          `Would delete ${targetMetafieldDefs.length} metafield definitions from ${options.to}`
        );
        ctx.logger.dryRunInfo(
          `Would delete ${targetMetaobjectDefs.length} metaobject definitions from ${options.to}`
        );
        ctx.logger.dryRunInfo(
          `Would copy ${sourceMetaobjectDefs.length} metaobject definitions from ${options.from} (with dependency resolution)`
        );
        ctx.logger.dryRunInfo(
          `Would copy ${sourceMetafieldDefs.length} metafield definitions from ${options.from}`
        );
        return;
      }

      // Interactive confirmation before proceeding with destructive bulk operation
      const confirmed = await ConfirmationPrompt.confirm({
        operation: 'Bulk Sync (Delete All + Copy All)',
        target: `${options.to} store`,
        impact: {
          metafields: targetMetafieldDefs.length + sourceMetafieldDefs.length,
          metaobjects:
            targetMetaobjectDefs.length + sourceMetaobjectDefs.length,
        },
        details: [
          `Will DELETE all ${
            targetMetafieldDefs.length + targetMetaobjectDefs.length
          } definitions from ${options.to}`,
          `Will COPY all ${
            sourceMetafieldDefs.length + sourceMetaobjectDefs.length
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
      if (targetMetafieldDefs.length > 0 || targetMetaobjectDefs.length > 0) {
        ctx.logger.info('Deleting all definitions from target store...');
        const deleteResults = await targetManager.deleteDefinitions({
          metafields: targetMetafieldDefs,
          metaobjects: targetMetaobjectDefs,
        });

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
      const copyResults = await targetManager.copyDefinitionsWithDependencies({
        metafields: sourceMetafieldDefs,
        metaobjects: sourceMetaobjectDefs,
      });

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
          metafields: targetMetafieldDefs.length,
          metaobjects: targetMetaobjectDefs.length,
        },
        errors: totalErrors,
      };
    });
  });

export { bulkCommand };
