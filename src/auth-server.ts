import { quickbooksClient } from './clients/quickbooks-client.js';

console.log('Starting QuickBooks OAuth flow...');
console.log('A browser window will open for you to authorize with Intuit.');

try {
  await quickbooksClient.authenticate();
  console.log('Authentication successful! Tokens saved to .env');
  process.exit(0);
} catch (error: any) {
  console.error('Authentication failed:', error.message);
  process.exit(1);
}
