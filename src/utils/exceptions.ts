export class ResearchAnalystException extends Error {
  fileName: string;
  lineNumber: number;
  traceback: string;

  constructor(errorMessage: string | Error, errorDetails?: any) {
    // Normalize message
    const normMsg = typeof errorMessage === 'string' 
      ? errorMessage 
      : errorMessage.message;

    super(normMsg);
    this.name = 'ResearchAnalystException';

    // Capture stack trace
    const stackLines = this.stack?.split('\n') || [];
    
    // Extract file name and line number from stack trace
    if (stackLines.length > 1) {
      const callerLine = stackLines[1].trim();
      const match = callerLine.match(/\(?(.+):(\d+):(\d+)\)?/);
      
      if (match) {
        this.fileName = match[1];
        this.lineNumber = parseInt(match[2]);
      } else {
        this.fileName = '<unknown>';
        this.lineNumber = -1;
      }
    } else {
      this.fileName = '<unknown>';
      this.lineNumber = -1;
    }

    // Create traceback string
    this.traceback = stackLines.slice(1).join('\n');

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ResearchAnalystException.prototype);
  }

  toString(): string {
    const base = `Error in [${this.fileName}] at line [${this.lineNumber}] | Message: ${this.message}`;
    if (this.traceback) {
      return `${base}\nTraceback:\n${this.traceback}`;
    }
    return base;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      traceback: this.traceback,
      stack: this.stack
    };
  }
}