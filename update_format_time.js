// Script to update formatTime functions in storage.ts with the new format
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the storage.ts file
const filePath = path.join(process.cwd(), 'server', 'storage.ts');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');

// New formatTime function with the desired format "HH:MM UTC"
const newFormatTimeFunction = `  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    }) + " UTC";
  }`;

// Use regular expression to find and replace both formatTime functions
// The pattern matches the entire function including indentation
const regex = /(\s+)private formatTime\(date: Date\): string {\s+return date\.toLocaleString\('en-US', {\s+year: 'numeric',\s+month: '2-digit',\s+day: '2-digit',\s+hour: 'numeric',\s+minute: '2-digit',\s+hour12: true,\s+timeZone: 'UTC'\s+}\) \+ " UTC";\s+}/g;

// Replace the matched pattern with the new function
content = content.replace(regex, newFormatTimeFunction);

// Write the modified content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Updated formatTime functions successfully!');
