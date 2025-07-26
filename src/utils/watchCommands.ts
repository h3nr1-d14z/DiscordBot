import { watch } from 'fs';
import path from 'path';
import { generateCommandDocs } from './generateCommandDocs';

let isGenerating = false;
let pendingGeneration = false;

async function regenerateDocs() {
  if (isGenerating) {
    pendingGeneration = true;
    return;
  }

  isGenerating = true;
  console.log('🔄 Regenerating command documentation...');
  
  try {
    await generateCommandDocs();
  } catch (error) {
    console.error('❌ Failed to generate docs:', error);
  }
  
  isGenerating = false;
  
  if (pendingGeneration) {
    pendingGeneration = false;
    regenerateDocs();
  }
}

export function watchCommands() {
  const commandsPath = path.join(__dirname, '../commands');
  
  console.log('👁️  Watching for command changes...');
  
  watch(commandsPath, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
      console.log(`📝 Command file ${eventType}: ${filename}`);
      regenerateDocs();
    }
  });
}

// Run if called directly
if (require.main === module) {
  watchCommands();
  console.log('Press Ctrl+C to stop watching...');
}