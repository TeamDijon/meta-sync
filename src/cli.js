#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

// Get package info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

// Import commands
import { bulkCommand } from './commands/bulk.js';
import { listCommand } from './commands/list.js';
import { copyCommand } from './commands/copy.js';
import { deleteCommand } from './commands/delete.js';
import { createConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('meta-sync')
  .description(
    'CLI tool to sync metafield/metaobject definitions between Shopify stores'
  )
  .version(packageJson.version);

// Global options
program
  .option('--dry-run', 'Preview changes without executing')
  .option('--verbose', 'Detailed logging output')
  .option('--config <path>', 'Custom config file location')
  .option('--log <path>', 'Custom log file location');

// Add commands
program.addCommand(bulkCommand);
program.addCommand(listCommand);
program.addCommand(copyCommand);
program.addCommand(deleteCommand);
program.addCommand(createConfigCommand());

// Parse arguments
program.parse();
