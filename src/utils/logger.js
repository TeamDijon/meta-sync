import { writeFileSync, appendFileSync } from 'fs';

class Logger {
  constructor(options = {}) {
    this.isVerbose = options.verbose || false;
    this.logFile = options.logFile || null;
    this.dryRun = options.dryRun || false;
  }

  info(message, data = null) {
    const logEntry = this._formatMessage('INFO', message, data);
    console.log(logEntry);
    this._writeToFile(logEntry);
  }

  success(message, data = null) {
    const logEntry = this._formatMessage('SUCCESS', message, data);
    console.log(`✅ ${logEntry}`);
    this._writeToFile(logEntry);
  }

  warning(message, data = null) {
    const logEntry = this._formatMessage('WARNING', message, data);
    console.warn(`⚠️  ${logEntry}`);
    this._writeToFile(logEntry);
  }

  error(message, data = null) {
    const logEntry = this._formatMessage('ERROR', message, data);
    console.error(`❌ ${logEntry}`);
    this._writeToFile(logEntry);
  }

  dryRunInfo(message, data = null) {
    if (this.dryRun) {
      const logEntry = this._formatMessage('DRY-RUN', message, data);
      console.log(`🔍 ${logEntry}`);
      this._writeToFile(logEntry);
    }
  }

  verbose(message, data = null) {
    if (this.isVerbose) {
      const logEntry = this._formatMessage('VERBOSE', message, data);
      console.log(`🔧 ${logEntry}`);
      this._writeToFile(logEntry);
    }
  }

  isVerboseMode() {
    return this.isVerbose;
  }

  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ${level}: ${message}`;

    if (data && this.isVerbose) {
      logEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
    }

    return logEntry;
  }

  _writeToFile(message) {
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, message + '\n');
      } catch (error) {
        console.warn(`Failed to write to log file: ${error.message}`);
      }
    }
  }

  startOperation(operation, details = {}) {
    this.info(`Starting ${operation}`, details);
    return Date.now();
  }

  endOperation(operation, startTime, results = {}) {
    const duration = Date.now() - startTime;
    this.success(`Completed ${operation} in ${duration}ms`, results);
  }
}

export function createLogger(options) {
  return new Logger(options);
}
