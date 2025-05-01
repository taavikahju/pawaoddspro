// Simple test script to verify date handling for Sportybet scraper
// This helps us understand why dates starting around 05.05 have issues

console.log("Testing different date handling approaches:");

const testDates = [
  "2025-04-25T19:45:00Z",
  "2025-05-05T19:45:00Z",
  "2025-05-10T19:45:00Z"
];

// Test with additional date formats we might receive
const alternateFormats = [
  "2025-05-05T19:45:00.000Z",  // with milliseconds
  "2025-05-05 19:45:00",      // without T and Z
  "2025/05/05 19:45:00",      // with slashes
  "5/5/2025 7:45 PM",         // US format
  "05.05.2025 19:45"          // European format
];

console.log("\n1. Current approach (using Date object):");
testDates.forEach(dateStr => {
  const date = new Date(dateStr);
  const formattedDate = date.toISOString().slice(0, 16).replace('T', ' ');
  console.log(`Original: ${dateStr} → Formatted: ${formattedDate}`);
});

console.log("\n2. New approach (direct string manipulation):");
testDates.forEach(dateStr => {
  const formattedDate = dateStr.slice(0, 16).replace('T', ' ');
  console.log(`Original: ${dateStr} → Formatted: ${formattedDate}`);
});

console.log("\n3. Testing additional date formats with Date object:");
alternateFormats.forEach(dateStr => {
  try {
    const date = new Date(dateStr);
    const formattedDate = date.toISOString().slice(0, 16).replace('T', ' ');
    console.log(`Original: ${dateStr} → Formatted: ${formattedDate} → Valid: ${!isNaN(date.getTime())}`);
  } catch (e) {
    console.log(`Original: ${dateStr} → Error: ${e.message}`);
  }
});

console.log("\n4. Raw timestamps vs. interpreted dates:");
const timestampTests = [
  { format: "May 5th event", date: "2025-05-05T19:45:00Z" },
  { format: "April 25th event", date: "2025-04-25T19:45:00Z" }
];

timestampTests.forEach(test => {
  const date = new Date(test.date);
  console.log(`\n${test.format}:`);
  console.log(`Original string: ${test.date}`);
  console.log(`Date object: ${date}`);
  console.log(`Date timestamp: ${date.getTime()}`);
  console.log(`UTC string: ${date.toUTCString()}`);
  console.log(`ISO string: ${date.toISOString()}`);
  console.log(`Locale string: ${date.toLocaleString()}`);
});

console.log("\n5. Current time in different formats:");
const now = new Date();
console.log(`Current Date object: ${now}`);
console.log(`Current timestamp: ${now.getTime()}`);
console.log(`Current ISO string: ${now.toISOString()}`);
console.log(`Current formatted: ${now.toISOString().slice(0, 16).replace('T', ' ')}`);