/**
 * Enhanced configuration management for Meta Sync
 * Centralizes configuration logic with validation, caching, and error handling
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { ShopifyClient } from '../shopify/client.js';

/**
 * Configuration validation schema
 */
const CONFIG_SCHEMA = {
  required: ['accessToken'],
  optional: ['domain', 'apiVersion', 'timeout', 'retryAttempts'],
  defaults: {
    apiVersion: '2025-01',
    timeout: 30000,
    retryAttempts: 3,
    logLevel: 'info',
  },
};

/**
 * Environment variable patterns for auto-discovery
 */
const ENV_PATTERNS = {
  STORE_TOKEN: /^([A-Z_]+)_STORE_TOKEN$/,
  STORE_URL: /^([A-Z_]+)_STORE_URL$/,
  // Legacy patterns
  ACCESS_TOKEN: /^SHOPIFY_([A-Z_]+)_ACCESS_TOKEN$/,
  DOMAIN: /^SHOPIFY_([A-Z_]+)_DOMAIN$/,
};

export class ConfigManager {
  static _instance = null;
  static _config = null;
  static _clients = new Map();

  /**
   * Singleton pattern for config access
   */
  static getInstance() {
    if (!this._instance) {
      this._instance = new ConfigManager();
    }
    return this._instance;
  }

  /**
   * Load and validate configuration with auto-discovery
   */
  loadConfig() {
    if (this._config) {
      return this._config;
    }

    // Auto-discover stores from environment variables
    const discoveredStores = this._discoverStoresFromEnv();

    // Add legacy hardcoded stores if they exist
    const legacyStores = this._loadLegacyStores();

    // Merge discovered and legacy stores
    const allStores = { ...discoveredStores, ...legacyStores };

    this._config = {
      stores: allStores,
      defaults: {
        logLevel: process.env.LOG_LEVEL || CONFIG_SCHEMA.defaults.logLevel,
        timeout: parseInt(
          process.env.SHOPIFY_TIMEOUT || CONFIG_SCHEMA.defaults.timeout
        ),
        retryAttempts: parseInt(
          process.env.RETRY_ATTEMPTS || CONFIG_SCHEMA.defaults.retryAttempts
        ),
        apiVersion:
          process.env.SHOPIFY_API_VERSION || CONFIG_SCHEMA.defaults.apiVersion,
        batchSize: parseInt(process.env.BATCH_SIZE || '100'),
        concurrency: parseInt(process.env.CONCURRENCY || '5'),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        isDevelopment: process.env.NODE_ENV !== 'production',
        debug: process.env.DEBUG === 'true',
      },
    };

    this._validateConfig();
    return this._config;
  }

  /**
   * Auto-discover stores from environment variables
   */
  _discoverStoresFromEnv() {
    const stores = {};

    // New pattern: STAGING_STORE_TOKEN, PRODUCTION_STORE_TOKEN, etc.
    for (const [key, value] of Object.entries(process.env)) {
      const tokenMatch = key.match(ENV_PATTERNS.STORE_TOKEN);
      if (tokenMatch && value) {
        const storeName = tokenMatch[1].toLowerCase();
        const urlKey = `${tokenMatch[1]}_STORE_URL`;

        stores[storeName] = {
          accessToken: value,
          domain: process.env[urlKey] || this._generateDefaultDomain(storeName),
          apiVersion:
            process.env.SHOPIFY_API_VERSION ||
            CONFIG_SCHEMA.defaults.apiVersion,
        };
      }

      // Legacy pattern: SHOPIFY_STAGING_ACCESS_TOKEN, etc.
      const legacyMatch = key.match(ENV_PATTERNS.ACCESS_TOKEN);
      if (legacyMatch && value && !stores[legacyMatch[1].toLowerCase()]) {
        const storeName = legacyMatch[1].toLowerCase();
        const domainKey = `SHOPIFY_${legacyMatch[1]}_DOMAIN`;

        stores[storeName] = {
          accessToken: value,
          domain:
            process.env[domainKey] || this._generateDefaultDomain(storeName),
          apiVersion:
            process.env.SHOPIFY_API_VERSION ||
            CONFIG_SCHEMA.defaults.apiVersion,
        };
      }
    }

    return stores;
  }

  /**
   * Load legacy hardcoded store configurations
   */
  _loadLegacyStores() {
    const legacyStores = {};

    // Only add legacy stores if they have access tokens
    const legacyConfigs = [
      {
        name: 'staging',
        token: 'SHOPIFY_STAGING_ACCESS_TOKEN',
        domain: 'SHOPIFY_STAGING_DOMAIN',
      },
      {
        name: 'production',
        token: 'SHOPIFY_PRODUCTION_ACCESS_TOKEN',
        domain: 'SHOPIFY_PRODUCTION_DOMAIN',
      },
      {
        name: 'dev',
        token: 'SHOPIFY_DEV_ACCESS_TOKEN',
        domain: 'SHOPIFY_DEV_DOMAIN',
      },
    ];

    for (const config of legacyConfigs) {
      if (process.env[config.token]) {
        legacyStores[config.name] = {
          accessToken: process.env[config.token],
          domain:
            process.env[config.domain] ||
            this._generateDefaultDomain(config.name),
          apiVersion:
            process.env.SHOPIFY_API_VERSION ||
            CONFIG_SCHEMA.defaults.apiVersion,
        };
      }
    }

    return legacyStores;
  }

  /**
   * Generate default domain name for a store
   */
  _generateDefaultDomain(storeName) {
    return `${storeName}.myshopify.com`;
  }

  /**
   * Validate the loaded configuration
   */
  _validateConfig() {
    if (!this._config.stores || Object.keys(this._config.stores).length === 0) {
      throw new Error(
        'No store configurations found. Please check your environment variables.\n' +
          'Expected formats:\n' +
          '  - STAGING_STORE_TOKEN and STAGING_STORE_URL\n' +
          '  - PRODUCTION_STORE_TOKEN and PRODUCTION_STORE_URL\n' +
          '  - Or legacy: SHOPIFY_STAGING_ACCESS_TOKEN and SHOPIFY_STAGING_DOMAIN'
      );
    }

    // Validate each store configuration
    for (const [storeName, config] of Object.entries(this._config.stores)) {
      for (const required of CONFIG_SCHEMA.required) {
        if (!config[required]) {
          throw new Error(
            `Store '${storeName}' is missing required field: ${required}`
          );
        }
      }
    }
  }

  /**
   * Get configuration for a specific store
   */
  getStoreConfig(storeName) {
    const config = this.loadConfig();
    const normalizedName = storeName.toLowerCase();

    if (!config.stores[normalizedName]) {
      const availableStores = this.getAvailableStores();
      throw new Error(
        `Unknown store: ${storeName}. Available stores: ${availableStores.join(
          ', '
        )}`
      );
    }

    const storeConfig = config.stores[normalizedName];

    // Additional validation
    if (!storeConfig.accessToken) {
      throw new Error(`Missing access token for store: ${storeName}`);
    }

    // Return a copy with defaults applied
    return {
      ...CONFIG_SCHEMA.defaults,
      ...storeConfig,
      storeName: normalizedName,
    };
  }

  /**
   * Get or create Shopify client with caching
   */
  getShopifyClient(storeName) {
    const normalizedName = storeName.toLowerCase();

    // Return cached client if available
    if (ConfigManager._clients.has(normalizedName)) {
      return ConfigManager._clients.get(normalizedName);
    }

    // Create new client
    const storeConfig = this.getStoreConfig(normalizedName);
    const storeDomain = this._extractStoreName(storeConfig.domain);
    const client = new ShopifyClient(storeConfig.accessToken, storeDomain);

    // Cache the client
    ConfigManager._clients.set(normalizedName, client);

    return client;
  }

  /**
   * Extract store name from domain
   */
  _extractStoreName(domain) {
    if (!domain) return null;

    // Handle full URLs or domains
    const match = domain.match(/^(?:https?:\/\/)?([^.]+)(?:\.myshopify\.com)?/);
    return match ? match[1] : domain;
  }

  /**
   * Validate multiple store names at once
   */
  validateStores(storeNames) {
    if (!Array.isArray(storeNames)) {
      throw new Error('Store names must be provided as an array');
    }

    const config = this.loadConfig();
    const availableStores = this.getAvailableStores();
    const invalidStores = storeNames.filter(
      (name) => !availableStores.includes(name.toLowerCase())
    );

    if (invalidStores.length > 0) {
      throw new Error(
        `Invalid store names: ${invalidStores.join(', ')}. ` +
          `Available stores: ${availableStores.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Get all available store names
   */
  getAvailableStores() {
    const config = this.loadConfig();
    return Object.keys(config.stores).filter(
      (name) => config.stores[name].accessToken
    );
  }

  /**
   * Get default configuration values
   */
  getDefaults() {
    const config = this.loadConfig();
    return { ...config.defaults };
  }

  /**
   * Get environment information
   */
  getEnvironment() {
    const config = this.loadConfig();
    return { ...config.environment };
  }

  /**
   * Check if a store is configured
   */
  hasStore(storeName) {
    const config = this.loadConfig();
    return config.stores.hasOwnProperty(storeName.toLowerCase());
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary() {
    const config = this.loadConfig();
    const storeCount = Object.keys(config.stores).length;
    const storeNames = Object.keys(config.stores);

    return {
      storeCount,
      stores: storeNames,
      environment: config.environment.nodeEnv,
      debug: config.environment.debug,
      defaults: config.defaults,
    };
  }

  /**
   * Get full configuration (excluding sensitive data by default)
   */
  getFullConfig(includeSensitive = false) {
    const config = this.loadConfig();

    if (!includeSensitive) {
      return {
        stores: Object.fromEntries(
          Object.entries(config.stores).map(([name, storeConfig]) => [
            name,
            {
              domain: storeConfig.domain,
              apiVersion: storeConfig.apiVersion,
              hasAccessToken: !!storeConfig.accessToken,
            },
          ])
        ),
        defaults: config.defaults,
        environment: config.environment,
      };
    }

    return { ...config };
  }

  /**
   * Clear cached clients and reload configuration
   */
  reload() {
    ConfigManager._clients.clear();
    ConfigManager._config = null;
    return this.loadConfig();
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static reset() {
    ConfigManager._instance = null;
    ConfigManager._config = null;
    ConfigManager._clients.clear();
  }
}

// Legacy function compatibility (maintains backward compatibility)
export function validateStoreNames(storeNames) {
  return ConfigManager.getInstance().validateStores(storeNames);
}

export function createShopifyClient(storeName) {
  return ConfigManager.getInstance().getShopifyClient(storeName);
}

export function getStoreConfig(storeName) {
  return ConfigManager.getInstance().getStoreConfig(storeName);
}

// New enhanced functions for Phase 3
export function getConfigManager() {
  return ConfigManager.getInstance();
}

export function getDefaults() {
  return ConfigManager.getInstance().getDefaults();
}

export function getEnvironment() {
  return ConfigManager.getInstance().getEnvironment();
}

export function getConfigSummary() {
  return ConfigManager.getInstance().getConfigSummary();
}
