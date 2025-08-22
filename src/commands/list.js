import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { CommandHandler } from '../utils/command-base.js';
import {
  COMMON_OPTIONS,
  createCommandAction,
  OPTION_DESCRIPTIONS,
} from '../utils/command-options.js';
import {
  isReservedMetafieldNamespace,
  isReservedMetaobjectType,
  filterDefinitionsByResourceType,
  RESOURCE_TYPES,
} from '../utils/constants.js';

class ListCommand extends CommandHandler {
  async execute(options) {
    const { store, output, resources, includeEntries } = options;

    const startTime = this.logger.startOperation('List Definitions', {
      store,
      outputFile: output,
      resources,
      includeEntries,
    });

    // Create client and manager
    const { client, manager } = this.createClients(store);

    this.logger.verbose('Connected to Shopify store', { store });

    // Fetch and filter definitions using base class method
    const filteredDefinitions = await this.fetchAndFilterDefinitions(manager, {
      includeEntries,
      resources,
    });

    // Generate report
    const report = this.generateMarkdownReport(
      filteredDefinitions.metafields,
      filteredDefinitions.metaobjects,
      store,
      resources,
      includeEntries
    );

    if (output) {
      // Write to file
      writeFileSync(output, report);
      this.logger.success(`Definitions exported to ${output}`);
    } else {
      // Output to console
      console.log(report);
    }

    this.logger.endOperation('List Definitions', startTime, {
      metafieldCount: filteredDefinitions.metafields.length,
      metaobjectCount: filteredDefinitions.metaobjects.length,
      resources,
    });
  }

  generateMarkdownReport(
    metafieldDefinitions,
    metaobjectDefinitions,
    storeName,
    resources = RESOURCE_TYPES.BOTH,
    includeEntries = false
  ) {
    // Count reserved definitions using the common utility
    const reserved = this.countReservedDefinitions({
      metafields: metafieldDefinitions,
      metaobjects: metaobjectDefinitions,
    });

    let report = `# Store Definitions: ${storeName}\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Adjust count message based on resource filter
    if (resources === RESOURCE_TYPES.METAFIELDS) {
      report += `Found ${metafieldDefinitions.length} metafield definitions.\n\n`;
    } else if (resources === RESOURCE_TYPES.METAOBJECTS) {
      report += `Found ${metaobjectDefinitions.length} metaobject definitions.\n\n`;
    } else {
      report += `Found ${metafieldDefinitions.length} metafield definitions and ${metaobjectDefinitions.length} metaobject definitions.\n\n`;
    }

    if (reserved.counts.total > 0) {
      report += `**⚠️ Reserved Definitions:** ${reserved.counts.metafields} metafields and ${reserved.counts.metaobjects} metaobjects are reserved by Shopify and cannot be modified by third-party apps.\n\n`;
    }

    // Only generate metafields section if we're including metafields
    if (
      resources === RESOURCE_TYPES.METAFIELDS ||
      resources === RESOURCE_TYPES.BOTH
    ) {
      report += `## Metafields\n\n`;

      // Sort metafields by namespace.key for better organization
      const sortedMetafields = metafieldDefinitions.sort((a, b) => {
        const aId = `${a.namespace}.${a.key}`;
        const bId = `${b.namespace}.${b.key}`;
        return aId.localeCompare(bId);
      });

      for (const def of sortedMetafields) {
        const isReserved = isReservedMetafieldNamespace(def.namespace);
        report += `### ${def.namespace}.${def.key}${
          isReserved ? ' ⚠️ RESERVED' : ''
        }\n\n`;
        report += `- **Type:** ${def.type.name}\n`;
        report += `- **Owner:** ${def.ownerType}\n`;
        if (def.description) {
          report += `- **Description:** ${def.description}\n`;
        }
        report += `- **Access:** Admin=${def.access.admin}, Storefront=${def.access.storefront}\n`;
        if (def.validations && def.validations.length > 0) {
          report += `- **Validations:** ${def.validations
            .map((v) => `${v.name}=${v.value}`)
            .join(', ')}\n`;
        }
        if (isReserved) {
          report += `- **⚠️ Note:** This is a reserved Shopify definition and cannot be modified by third-party apps\n`;
        }
        report += '\n';
      }
    } // End metafields condition

    // Only generate metaobjects section if we're including metaobjects
    if (
      resources === RESOURCE_TYPES.METAOBJECTS ||
      resources === RESOURCE_TYPES.BOTH
    ) {
      report += `## Metaobjects\n\n`;

      // Sort metaobjects by type
      const sortedMetaobjects = metaobjectDefinitions.sort((a, b) =>
        a.type.localeCompare(b.type)
      );

      for (const def of sortedMetaobjects) {
        const isReserved = isReservedMetaobjectType(def.type);
        report += `### ${def.type}${isReserved ? ' ⚠️ RESERVED' : ''}\n\n`;
        report += `- **Name:** ${def.name}\n`;
        if (def.description) {
          report += `- **Description:** ${def.description}\n`;
        }

        // Show entry count if available
        if (includeEntries && typeof def.entriesCount === 'number') {
          report += `- **Entries:** ${def.entriesCount} entries found\n`;
        }

        report += `- **Fields:**\n`;
        for (const field of def.fieldDefinitions) {
          report += `  - **${field.key}** (${field.type.name})`;
          if (field.required) {
            report += ` *required*`;
          }
          if (field.description) {
            report += ` - ${field.description}`;
          }
          report += '\n';
        }

        report += `- **Access:** Admin=${def.access.admin}, Storefront=${def.access.storefront}\n`;

        const capabilities = [];
        if (def.capabilities.publishable?.enabled)
          capabilities.push('publishable');
        if (def.capabilities.translatable?.enabled)
          capabilities.push('translatable');
        if (capabilities.length > 0) {
          report += `- **Capabilities:** ${capabilities.join(', ')}\n`;
        }

        if (isReserved) {
          report += `- **⚠️ Note:** This is a reserved Shopify definition and cannot be modified by third-party apps\n`;
        }

        report += '\n';
      }
    } // End metaobjects condition

    return report;
  }
}

const listCommand = COMMON_OPTIONS.withResourceFilter(
  COMMON_OPTIONS.withEntries(
    COMMON_OPTIONS.withOutput(
      new Command('list')
        .description(
          'List all metafield and metaobject definitions from a store'
        )
        .requiredOption(
          '--store <store>',
          'Store name (staging, production, etc.)'
        )
    )
  )
).action(createCommandAction(ListCommand));

export { listCommand };
