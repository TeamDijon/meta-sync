/**
 * Configuration diagnostics command for Phase 3 testing
 * Displays enhanced configuration information and validates setup
 */

import { Command } from 'commander';
import {
  getConfigManager,
  getConfigSummary,
  getEnvironment,
  getDefaults,
} from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

export function createConfigCommand() {
  const command = new Command('config');

  command
    .description('Display configuration information and diagnostics')
    .option('--verbose', 'Show detailed configuration information')
    .option('--secrets', 'Include sensitive information (access tokens)')
    .action(async (options) => {
      const logger = createLogger({ verbose: options.verbose });

      try {
        logger.info('=== Configuration Diagnostics ===');

        // Get configuration manager
        const configManager = getConfigManager();
        const summary = getConfigSummary();
        const environment = getEnvironment();
        const defaults = getDefaults();

        // Display basic information
        console.log('\n📊 Configuration Summary:');
        console.log(`  Stores configured: ${summary.storeCount}`);
        console.log(`  Available stores: ${summary.stores.join(', ')}`);
        console.log(`  Environment: ${environment.nodeEnv}`);
        console.log(
          `  Debug mode: ${environment.debug ? 'enabled' : 'disabled'}`
        );

        // Display defaults
        console.log('\n⚙️  Default Settings:');
        console.log(`  API Version: ${defaults.apiVersion}`);
        console.log(`  Timeout: ${defaults.timeout}ms`);
        console.log(`  Retry attempts: ${defaults.retryAttempts}`);
        console.log(`  Batch size: ${defaults.batchSize}`);
        console.log(`  Concurrency: ${defaults.concurrency}`);

        // Display store details
        console.log('\n🏪 Store Details:');
        for (const storeName of summary.stores) {
          const storeConfig = configManager.getStoreConfig(storeName);
          console.log(`  ${storeName}:`);
          console.log(`    Domain: ${storeConfig.domain}`);
          console.log(`    API Version: ${storeConfig.apiVersion}`);
          console.log(
            `    Has Access Token: ${storeConfig.accessToken ? '✅' : '❌'}`
          );

          if (options.secrets && storeConfig.accessToken) {
            const token = storeConfig.accessToken;
            const maskedToken =
              token.substring(0, 8) + '...' + token.substring(token.length - 4);
            console.log(`    Access Token: ${maskedToken}`);
          }
        }

        // Test client creation
        console.log('\n🔧 Client Creation Test:');
        for (const storeName of summary.stores) {
          try {
            const client = configManager.getShopifyClient(storeName);
            console.log(`  ${storeName}: ✅ Client created successfully`);

            if (options.verbose) {
              console.log(`    Store URL: ${client.apiUrl}`);
            }
          } catch (error) {
            console.log(`  ${storeName}: ❌ ${error.message}`);
          }
        }

        // Display full configuration if verbose
        if (options.verbose) {
          console.log('\n🔍 Full Configuration:');
          const fullConfig = configManager.getFullConfig(options.secrets);
          console.log(JSON.stringify(fullConfig, null, 2));
        }

        console.log('\n✅ Configuration diagnostics completed successfully');
      } catch (error) {
        logger.error('Configuration diagnostics failed:', error.message);

        // Provide helpful troubleshooting information
        console.log('\n💡 Troubleshooting:');
        console.log(
          '  1. Check your .env file exists and contains store configurations'
        );
        console.log('  2. Verify environment variable formats:');
        console.log('     - STAGING_STORE_TOKEN=your_token');
        console.log('     - STAGING_STORE_URL=your-store.myshopify.com');
        console.log('  3. Or use legacy format:');
        console.log('     - SHOPIFY_STAGING_ACCESS_TOKEN=your_token');
        console.log('     - SHOPIFY_STAGING_DOMAIN=your-store.myshopify.com');

        process.exit(1);
      }
    });

  return command;
}
