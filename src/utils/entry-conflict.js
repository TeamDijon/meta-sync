import { ENTRY_CONFLICT_ACTIONS } from './constants.js';

export class EntryConflictResolver {
  constructor(logger, dryRun = false) {
    this.logger = logger;
    this.dryRun = dryRun;
    this.globalAction = null; // Store global decision (update_all or skip_all)
  }

  async resolveConflict(sourceEntry, targetEntry, entryIdentifier) {
    // If we have a global decision, use it
    if (this.globalAction === ENTRY_CONFLICT_ACTIONS.UPDATE_ALL) {
      return ENTRY_CONFLICT_ACTIONS.UPDATE;
    }
    if (this.globalAction === ENTRY_CONFLICT_ACTIONS.SKIP_ALL) {
      return ENTRY_CONFLICT_ACTIONS.SKIP;
    }

    // In dry-run mode, default to update for preview
    if (this.dryRun) {
      this.logger.dryRunInfo(
        `Would ask for conflict resolution: ${entryIdentifier}`
      );
      return ENTRY_CONFLICT_ACTIONS.UPDATE;
    }

    // Show conflict information
    this.logger.warning(`\nConflict detected for entry: ${entryIdentifier}`);
    this.logger.info('Source entry fields:');
    this.logEntryFields(sourceEntry.fields, '  ');
    this.logger.info('Target entry fields:');
    this.logEntryFields(targetEntry.fields, '  ');

    // Prompt user for action
    const action = await this.promptForAction();

    // Handle global actions
    if (
      action === ENTRY_CONFLICT_ACTIONS.UPDATE_ALL ||
      action === ENTRY_CONFLICT_ACTIONS.SKIP_ALL
    ) {
      this.globalAction = action;
      return action === ENTRY_CONFLICT_ACTIONS.UPDATE_ALL
        ? ENTRY_CONFLICT_ACTIONS.UPDATE
        : ENTRY_CONFLICT_ACTIONS.SKIP;
    }

    return action;
  }

  logEntryFields(fields, indent = '') {
    for (const field of fields) {
      const value = field.value ? field.value.substring(0, 100) : 'null';
      const truncated = field.value && field.value.length > 100 ? '...' : '';
      this.logger.info(`${indent}${field.key}: ${value}${truncated}`);
    }
  }

  async promptForAction() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const prompt = () => {
        rl.question(
          '\nWhat would you like to do?\n' +
            '  [U]pdate - Overwrite target entry with source\n' +
            '  [S]kip - Keep target entry unchanged\n' +
            '  [A]ll Update - Update this and all future conflicts\n' +
            '  [N]ever Update - Skip this and all future conflicts\n' +
            '  [Q]uit - Stop operation\n' +
            'Choice: ',
          (answer) => {
            const choice = answer.toLowerCase().trim();

            switch (choice) {
              case 'u':
              case 'update':
                rl.close();
                resolve(ENTRY_CONFLICT_ACTIONS.UPDATE);
                break;
              case 's':
              case 'skip':
                rl.close();
                resolve(ENTRY_CONFLICT_ACTIONS.SKIP);
                break;
              case 'a':
              case 'all':
              case 'all update':
                rl.close();
                resolve(ENTRY_CONFLICT_ACTIONS.UPDATE_ALL);
                break;
              case 'n':
              case 'never':
              case 'never update':
                rl.close();
                resolve(ENTRY_CONFLICT_ACTIONS.SKIP_ALL);
                break;
              case 'q':
              case 'quit':
                rl.close();
                resolve(ENTRY_CONFLICT_ACTIONS.QUIT);
                break;
              default:
                console.log('Invalid choice. Please try again.');
                prompt();
            }
          }
        );
      };

      prompt();
    });
  }

  reset() {
    this.globalAction = null;
  }
}
