import { createInterface } from 'readline';

/**
 * Interactive confirmation utility for destructive operations
 */
export class ConfirmationPrompt {
  /**
   * Ask for confirmation before proceeding with a destructive operation
   * @param {Object} options - Configuration options
   * @param {string} options.operation - Name of the operation (e.g., "delete", "bulk sync")
   * @param {string} options.target - Target store or resource
   * @param {Object} options.impact - Impact details
   * @param {number} options.impact.metafields - Number of metafields affected
   * @param {number} options.impact.metaobjects - Number of metaobjects affected
   * @param {Array} options.details - Additional details to show
   * @param {boolean} options.skipConfirmation - Skip confirmation (for automation)
   * @returns {Promise<boolean>} - True if confirmed, false if cancelled
   */
  static async confirm(options) {
    const {
      operation,
      target,
      impact,
      details = [],
      skipConfirmation = false,
    } = options;

    // Skip confirmation if requested (for automation/CI)
    if (skipConfirmation) {
      return true;
    }

    const totalItems = (impact.metafields || 0) + (impact.metaobjects || 0);

    console.log('\n🚨 DESTRUCTIVE OPERATION CONFIRMATION\n');
    console.log(`Operation: ${operation}`);
    console.log(`Target: ${target}`);
    console.log(`Impact: ${totalItems} definitions will be affected`);

    if (impact.metafields > 0) {
      console.log(`  - Metafields: ${impact.metafields}`);
    }
    if (impact.metaobjects > 0) {
      console.log(`  - Metaobjects: ${impact.metaobjects}`);
    }

    if (details.length > 0) {
      console.log('\nAdditional Details:');
      details.forEach((detail) => console.log(`  - ${detail}`));
    }

    console.log('\n⚠️  WARNING: This action cannot be undone!');
    console.log(
      '⚠️  All associated metafield values will also be permanently deleted!'
    );

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await new Promise((resolve) => {
        rl.question('\nDo you want to proceed? (yes/NO): ', resolve);
      });

      const confirmed = answer.toLowerCase().trim() === 'yes';

      if (confirmed) {
        console.log('✅ Confirmed. Proceeding with operation...\n');
      } else {
        console.log('❌ Operation cancelled by user.\n');
      }

      return confirmed;
    } finally {
      rl.close();
    }
  }
}
