// Script to update formatTime functions
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'server', 'storage.ts');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Updated formatTime function with UTC format
const newFormatTime = `  private formatTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    }) + " UTC";
  }`;

// Replace all formatTime functions with the updated version
const updatedContent = fileContent.replace(/private formatTime\(date: Date\): string \{[\s\S]*?hour12: true[\s\S]*?\};/g, newFormatTime);

fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Updated formatTime functions to use UTC format');