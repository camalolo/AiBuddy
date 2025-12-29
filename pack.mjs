import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

try {
  // Read manifest.json to get version
  const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
  const version = manifest.version;

  // Create dist directory if it doesn't exist
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
  }

  // Build the extension using web-ext (creates zip)
  execSync('npx web-ext build --overwrite-dest', { stdio: 'inherit' });

  // Move the generated zip to dist with a cleaner name
  const sourceZip = path.join('web-ext-artifacts', `ai_buddy-${version}.zip`);
  const targetZip = path.join('dist', `ai-buddy-v${version}.zip`);

  try {
    fs.accessSync(sourceZip);
    fs.copyFileSync(sourceZip, targetZip);
    console.log(`Successfully packed extension to: ${targetZip}`);
  } catch {
    throw new Error(`Generated zip file not found: ${sourceZip}`);
  }
} catch (error) {
  console.error('Error packing extension:', error.message);
  throw error;
}