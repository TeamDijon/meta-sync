/**
 * Configuration utilities for Meta Sync
 * This file provides backward compatibility while leveraging the enhanced ConfigManager
 */

import {
  ConfigManager,
  validateStoreNames as validateStoresNew,
  createShopifyClient as createClientNew,
  getStoreConfig as getStoreConfigNew,
  getConfigManager as getConfigManagerFromManager,
  getDefaults as getDefaultsFromManager,
  getEnvironment as getEnvironmentFromManager,
  getConfigSummary as getConfigSummaryFromManager,
} from './config-manager.js';

/**
 * Legacy getStoreConfig function - maintained for backward compatibility
 */
export function getStoreConfig(storeName) {
  return getStoreConfigNew(storeName);
}

/**
 * Legacy createShopifyClient function - maintained for backward compatibility
 */
export function createShopifyClient(storeName) {
  return createClientNew(storeName);
}

/**
 * Legacy validateStoreNames function - maintained for backward compatibility
 */
export function validateStoreNames(stores) {
  return validateStoresNew(stores);
}

/**
 * Enhanced configuration functions (Phase 3)
 */

/**
 * Get the singleton ConfigManager instance
 */
export function getConfigManager() {
  return getConfigManagerFromManager();
}

/**
 * Get default configuration values
 */
export function getDefaults() {
  return getDefaultsFromManager();
}

/**
 * Get environment information
 */
export function getEnvironment() {
  return getEnvironmentFromManager();
}

/**
 * Get all available store names
 */
export function getAvailableStores() {
  return getConfigManager().getAvailableStores();
}

/**
 * Check if a store is configured
 */
export function hasStore(storeName) {
  return getConfigManager().hasStore(storeName);
}

/**
 * Get configuration summary for debugging
 */
export function getConfigSummary() {
  return getConfigSummaryFromManager();
}

/**
 * Reload configuration from environment
 */
export function reloadConfig() {
  return getConfigManager().reload();
}
