import { getMemoryScore, runMemoryRetrievalTests } from '../services/memoryScore';

async function main() {
  const [snapshot, report] = await Promise.all([getMemoryScore(), runMemoryRetrievalTests()]);
  console.log(JSON.stringify({ snapshot, report }, null, 2));
}

main().catch((error) => {
  console.error('[memory-score-cron] failed:', error);
  process.exit(1);
});
