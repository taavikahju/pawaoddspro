import * as fs from 'fs';
import * as path from 'path';

// MemStorage formatTime replacement
const memStorageFormatTime = `  private formatTime(date: Date): string {
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

// DatabaseStorage formatTime replacement
const dbStorageFormatTime = `  private formatTime(date: Date): string {
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

try {
  const filePath = path.join(process.cwd(), 'server', 'storage.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the formatTime function in MemStorage
  content = content.replace(/private formatTime\(date: Date\): string {\s+return date\.toLocaleTimeString\('en-US', {\s+hour: 'numeric',\s+minute: '2-digit',\s+hour12: true\s+}\);(\s+)}/g, 
  (match, spacing) => memStorageFormatTime + spacing);
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated the formatTime functions to use UTC');
} catch (error) {
  console.error('Error:', error);
}