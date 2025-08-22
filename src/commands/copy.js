import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import { ManifestParser } from '../utils/manifest.js';

const copyCommand = new Command('copy')
  .description('Copy metafield and metaobject definitions between stores')
  .requiredOption('--from <store>', 'Source store name')
  .requiredOption('--to <store>', 'Target store name')
  .option(
    '--manifest <file>',
    'Manifest file specifying which definitions to copy'
  )
  .action(async (options, command) => {
    const handler = new CommandHandler(
      'Copy Definitions',
      options,
      command.parent.opts()
    );

    await handler.execute(async (ctx) => {
      // Create clients for both stores
      const clients = ctx.createClients([options.from, options.to]);
      const sourceManager = ctx.createManager(clients[options.from]);
      const targetManager = ctx.createManager(clients[options.to]);

      // Get all definitions from source
      ctx.logger.info(
        `Fetching definitions from source store (${options.from})...`
      );
      const sourceDefinitions = await sourceManager.getAllDefinitions();

      let definitionsToCopy;

      if (options.manifest) {
        // Parse manifest and find matching definitions
        ctx.logger.info(`Parsing manifest file: ${options.manifest}`);
        const manifestDefs = ManifestParser.parseFile(options.manifest);

        ctx.logger.verbose('Parsed manifest:', {
          metafields: manifestDefs.metafields.length,
          metaobjects: manifestDefs.metaobjects.length,
        });

        const matches = ManifestParser.findMatchingDefinitions(
          manifestDefs,
          sourceDefinitions
        );

        if (matches.notFound.length > 0) {
          ctx.logger.warning(
            'Some definitions from manifest were not found in source store:'
          );
          matches.notFound.forEach((def) => {
            ctx.logger.warning(`  - ${def.type}: ${def.identifier}`);
          });
        }

        definitionsToCopy = {
          metafields: matches.metafields,
          metaobjects: matches.metaobjects,
        };

        ctx.logger.info('Matched definitions from manifest:', {
          metafields: matches.metafields.length,
          metaobjects: matches.metaobjects.length,
        });
      } else {
        // Copy all definitions
        definitionsToCopy = sourceDefinitions;
        ctx.logger.info('Will copy ALL definitions:', {
          metafields: sourceDefinitions.metafields.length,
          metaobjects: sourceDefinitions.metaobjects.length,
        });
      }

      if (
        definitionsToCopy.metafields.length === 0 &&
        definitionsToCopy.metaobjects.length === 0
      ) {
        ctx.logger.warning('No definitions to copy!');
        return;
      }

      // Check for conflicts in target store
      ctx.logger.info(
        `Checking for existing definitions in target store (${options.to})...`
      );
      const targetDefinitions = await targetManager.getAllDefinitions();

      const conflicts = {
        metafields: [],
        metaobjects: [],
      };

      // Check metafield conflicts
      for (const def of definitionsToCopy.metafields) {
        const existing = targetDefinitions.metafields.find(
          (target) =>
            target.namespace === def.namespace && target.key === def.key
        );
        if (existing) {
          conflicts.metafields.push({
            source: def,
            target: existing,
          });
        }
      }

      // Check metaobject conflicts
      for (const def of definitionsToCopy.metaobjects) {
        const existing = targetDefinitions.metaobjects.find(
          (target) => target.type === def.type
        );
        if (existing) {
          conflicts.metaobjects.push({
            source: def,
            target: existing,
          });
        }
      }

      // Report conflicts
      const totalConflicts =
        conflicts.metafields.length + conflicts.metaobjects.length;
      if (totalConflicts > 0) {
        ctx.logger.warning(
          `Found ${totalConflicts} conflicting definitions in target store:`
        );
        conflicts.metafields.forEach((conflict) => {
          ctx.logger.warning(
            `  - Metafield: ${conflict.source.namespace}/${conflict.source.key}`
          );
        });
        conflicts.metaobjects.forEach((conflict) => {
          ctx.logger.warning(`  - Metaobject: ${conflict.source.type}`);
        });

        if (!ctx.globalOpts.dryRun) {
          ctx.logger.warning('Existing definitions will be OVERWRITTEN!');
          // TODO: Add interactive confirmation in future
        }
      }

      if (ctx.globalOpts.dryRun) {
        ctx.logger.dryRunInfo('DRY RUN - No actual changes will be made');
        return;
      }

      // Delete conflicting definitions from target first
      if (totalConflicts > 0) {
        ctx.logger.info(
          'Removing conflicting definitions from target store...'
        );
        const conflictingDefinitions = {
          metafields: conflicts.metafields.map((c) => c.target),
          metaobjects: conflicts.metaobjects.map((c) => c.target),
        };

        const deleteResults = await targetManager.deleteDefinitions(
          conflictingDefinitions
        );

        ctx.logger.info('Deleted conflicting definitions:', {
          metafields: deleteResults.metafields.success,
          metaobjects: deleteResults.metaobjects.success,
          errors:
            deleteResults.metafields.errors.length +
            deleteResults.metaobjects.errors.length,
        });
      }

      // Copy definitions to target
      ctx.logger.info('Copying definitions to target store...');
      const copyResults = await targetManager.copyDefinitionsWithDependencies(
        definitionsToCopy
      );

      const totalSuccess =
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
          total: totalSuccess,
        },
        errors: totalErrors,
        conflictsResolved: totalConflicts,
      };
    });
  });

export { copyCommand };
