import { Command } from 'commander';
import { CommandHandler } from '../utils/command-base.js';
import {
  COMMON_OPTIONS,
  createCommandAction,
} from '../utils/command-options.js';
import { ManifestParser } from '../utils/manifest.js';
import { EntryConflictResolver } from '../utils/entry-conflict.js';
import { validateStoreNames, createShopifyClient } from '../utils/config.js';
import { DefinitionManager } from '../managers/definition.js';

class CopyCommand extends CommandHandler {
  async execute(options) {
    const { from, to, manifest, resources, includeEntries } = options;

    const startTime = this.logger.startOperation('Copy Definitions', {
      from,
      to,
      manifest,
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

    let definitionsToCopy;

    if (manifest) {
      // Manifest-based copying
      this.logger.info(`Parsing manifest file: ${manifest}`);
      const manifestDefs = ManifestParser.parseFile(manifest);

      const sourceDefinitions = await this.fetchAndFilterDefinitions(
        sourceManager,
        {
          includeEntries,
          resources,
        }
      );

      const matches = ManifestParser.findMatchingDefinitions(
        manifestDefs,
        sourceDefinitions
      );

      if (matches.notFound.length > 0) {
        this.logger.warning(
          'Some definitions from manifest were not found in source store:'
        );
        matches.notFound.forEach((def) => {
          this.logger.warning(`  - ${def.type}: ${def.identifier}`);
        });
      }

      definitionsToCopy = {
        metafields: matches.metafields,
        metaobjects: matches.metaobjects,
      };

      // If entries are requested, fetch them for the matching metaobject definitions
      if (includeEntries && definitionsToCopy.metaobjects.length > 0) {
        this.logger.verbose(
          'Fetching entries for manifest-defined metaobjects...'
        );
        for (const metaobjectDef of definitionsToCopy.metaobjects) {
          try {
            metaobjectDef.entries = await sourceManager.getMetaobjectEntries(
              metaobjectDef.type
            );
            this.logger.verbose(
              `Found ${metaobjectDef.entries.length} entries for ${metaobjectDef.type}`
            );
          } catch (error) {
            this.logger.warning(
              `Failed to fetch entries for ${metaobjectDef.type}: ${error.message}`
            );
            metaobjectDef.entries = [];
          }
        }
      }
    } else {
      // Copy all definitions
      this.logger.info(
        `Will copy ALL definitions (filtered by resource type):`
      );
      definitionsToCopy = await this.fetchAndFilterDefinitions(sourceManager, {
        includeEntries,
        resources,
      });
    }

    // Prepare definitions for copying
    definitionsToCopy = await this.prepareDefinitionsForOperation(
      sourceManager,
      definitionsToCopy,
      { operation: 'copy' }
    );

    // Check for conflicts in target store
    this.logger.info(
      `Checking for existing definitions in target store (${to})...`
    );
    const targetDefinitions = await targetManager.getAllDefinitions();

    const conflicts = {
      metafields: [],
      metaobjects: [],
    };

    // Check metafield conflicts
    for (const def of definitionsToCopy.metafields) {
      const existing = targetDefinitions.metafields.find(
        (target) => target.namespace === def.namespace && target.key === def.key
      );
      if (existing) {
        conflicts.metafields.push({ source: def, target: existing });
      }
    }

    // Check metaobject conflicts
    for (const def of definitionsToCopy.metaobjects) {
      const existing = targetDefinitions.metaobjects.find(
        (target) => target.type === def.type
      );
      if (existing) {
        conflicts.metaobjects.push({ source: def, target: existing });
      }
    }

    // Report conflicts
    const totalConflicts =
      conflicts.metafields.length + conflicts.metaobjects.length;
    if (totalConflicts > 0) {
      this.logger.warning(
        `Found ${totalConflicts} conflicting definitions in target store:`
      );
      conflicts.metafields.forEach((conflict) => {
        this.logger.warning(
          `  - Metafield: ${conflict.source.namespace}/${conflict.source.key}`
        );
      });
      conflicts.metaobjects.forEach((conflict) => {
        this.logger.warning(`  - Metaobject: ${conflict.source.type}`);
      });

      if (!this.globalOpts.dryRun) {
        this.logger.warning('Existing definitions will be OVERWRITTEN!');
      }
    }

    // Log summary
    this.logDefinitionSummary(definitionsToCopy, {
      includeEntries,
      operation: 'copy',
      verbose: this.logger.isVerbose,
    });

    if (this.globalOpts.dryRun) {
      this.logger.dryRunInfo('DRY RUN - No actual changes will be made');
      return;
    }

    // Delete conflicting definitions from target first
    if (totalConflicts > 0) {
      this.logger.info('Removing conflicting definitions from target store...');
      const conflictingDefinitions = {
        metafields: conflicts.metafields.map((c) => c.target),
        metaobjects: conflicts.metaobjects.map((c) => c.target),
      };

      const deleteResults = await targetManager.deleteDefinitions(
        conflictingDefinitions
      );
      this.logger.info('Deleted conflicting definitions:', {
        metafields: deleteResults.metafields.success,
        metaobjects: deleteResults.metaobjects.success,
        errors:
          deleteResults.metafields.errors.length +
          deleteResults.metaobjects.errors.length,
      });
    }

    // Copy definitions to target
    this.logger.info('Copying definitions to target store...');
    const copyResults = await targetManager.copyDefinitionsWithDependencies(
      definitionsToCopy,
      false, // dryRun = false
      sourceManager // pass source manager for reference resolution
    );

    // Handle entries if requested
    let entryCopyResults = { success: 0, errors: [], skipped: 0 };
    if (includeEntries && definitionsToCopy.metaobjects.length > 0) {
      this.logger.info('Copying metaobject entries...');

      const entryConflictResolver = new EntryConflictResolver(
        this.logger,
        this.globalOpts.dryRun
      );

      entryCopyResults = await targetManager.copyMetaobjectEntries(
        definitionsToCopy,
        entryConflictResolver,
        this.globalOpts.dryRun
      );

      if (entryCopyResults.errors.length > 0) {
        this.logger.warning(
          `Entry copy completed with ${entryCopyResults.errors.length} errors.`
        );
        entryCopyResults.errors.forEach((error) => {
          this.logger.error(
            `Entry error - ${error.identifier}: ${error.error}`
          );
        });
      }

      if (entryCopyResults.success > 0) {
        this.logger.success(
          `Successfully copied ${entryCopyResults.success} entries`
        );
      }

      if (entryCopyResults.skipped > 0) {
        this.logger.info(
          `Skipped ${entryCopyResults.skipped} entries due to conflicts`
        );
      }
    }

    // Summary
    const totalSuccess =
      copyResults.metafields.success + copyResults.metaobjects.success;
    const totalErrors =
      copyResults.metafields.errors.length +
      copyResults.metaobjects.errors.length +
      entryCopyResults.errors.length;

    this.logger.endOperation('Copy Definitions', startTime, {
      copied: {
        metafields: copyResults.metafields.success,
        metaobjects: copyResults.metaobjects.success,
        entries: entryCopyResults.success,
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

// Create command with standardized options
const copyCommand = COMMON_OPTIONS.withStandardOptions(
  COMMON_OPTIONS.withManifest(
    new Command('copy')
      .description('Copy metafield and metaobject definitions between stores')
      .requiredOption('--from <store>', 'Source store name')
      .requiredOption('--to <store>', 'Target store name')
  )
).action(createCommandAction(CopyCommand));

export { copyCommand, CopyCommand };
