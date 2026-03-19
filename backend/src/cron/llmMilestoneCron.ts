import cron from 'node-cron';
import {
  LLM_GENERATION_CONFIG,
  regenerateWithRetry,
  readLlmCacheFile,
  shouldRegenerate,
} from '../services/llmMilestones';

let cronInitialized = false;

export function initLlmMilestoneCron() {
  if (cronInitialized) {
    return;
  }
  cronInitialized = true;

  cron.schedule(LLM_GENERATION_CONFIG.cronInterval, async () => {
    console.log('[Cron] Starting LLM milestone generation...');
    try {
      await regenerateLlmMilestones();
      console.log('[Cron] LLM milestone generation completed');
    } catch (error) {
      console.error('[Cron] LLM milestone generation failed:', error);
    }
  });

  setImmediate(() => {
    regenerateLlmMilestones().catch((error) => {
      console.error('[Cron] Initial LLM milestone generation failed:', error);
    });
  });
}

async function regenerateLlmMilestones() {
  const cache = await readLlmCacheFile();
  if (!shouldRegenerate(cache)) {
    console.log('[Cron] Cache still fresh, skipping generation');
    return;
  }

  try {
    await regenerateWithRetry();
    console.log('[Cron] New LLM milestones saved');
  } catch (error) {
    console.error('[Cron] Generation failed:', error);
    throw error;
  }
}
