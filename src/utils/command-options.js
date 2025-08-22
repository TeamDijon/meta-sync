/**
 * Reusable command options and descriptions
 * Centralizes common option definitions to reduce duplication
 */

import { RESOURCE_TYPES, RESOURCE_TYPE_OPTIONS } from './constants.js';

// Option descriptions - centralized for consistency
export const OPTION_DESCRIPTIONS = {
  RESOURCES: `Resource types to include (${RESOURCE_TYPE_OPTIONS.join(', ')})`,
  INCLUDE_ENTRIES: 'Include metaobject entries in the operation',
  SKIP_CONFIRMATION: 'Skip confirmation prompt (use with caution!)',
  DRY_RUN: 'Preview changes without executing them',
  VERBOSE: 'Enable detailed logging output',
  LOG_FILE: 'Save logs to specified file path',
  OUTPUT_FILE: 'Output file path (markdown format)',
  MANIFEST_FILE: 'Manifest file specifying which definitions to process',
};

// Reusable option mixins
export const COMMON_OPTIONS = {
  /**
   * Add resource type filtering option
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command
   */
  withResourceFilter(command) {
    return command.option(
      '--resources <type>',
      OPTION_DESCRIPTIONS.RESOURCES,
      RESOURCE_TYPES.BOTH
    );
  },

  /**
   * Add metaobject entries option
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command
   */
  withEntries(command) {
    return command.option(
      '--include-entries',
      OPTION_DESCRIPTIONS.INCLUDE_ENTRIES
    );
  },

  /**
   * Add confirmation skip option
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command
   */
  withConfirmationSkip(command) {
    return command.option('--yes', OPTION_DESCRIPTIONS.SKIP_CONFIRMATION);
  },

  /**
   * Add manifest file option
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command
   */
  withManifest(command) {
    return command.option(
      '--manifest <file>',
      OPTION_DESCRIPTIONS.MANIFEST_FILE
    );
  },

  /**
   * Add output file option
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command
   */
  withOutput(command) {
    return command.option('--output <file>', OPTION_DESCRIPTIONS.OUTPUT_FILE);
  },

  /**
   * Add all common options for most commands
   * @param {Command} command - Commander.js command instance
   * @returns {Command} - Modified command with all common options
   */
  withStandardOptions(command) {
    return this.withResourceFilter(
      this.withEntries(this.withConfirmationSkip(command))
    );
  },
};

/**
 * Standard command action wrapper that creates consistent class-based handlers
 * @param {Class} HandlerClass - The command handler class
 * @returns {Function} - Action function for Commander.js
 */
export function createCommandAction(HandlerClass) {
  return async (options, command) => {
    const handler = new HandlerClass(command.parent.opts());
    await handler.run(options);
  };
}
