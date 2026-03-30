import { scrapCurrentEvaluationData } from './services/scrap-bamf-current-evaluation';
import { updateConfigSyncTime } from './services/config';

scrapCurrentEvaluationData().then(() => {
    updateConfigSyncTime('checkEvaluation');
    console.log('Evaluation check completed successfully');
    process.exit(0);
}).catch((err) => {
    console.error('Error checking evaluation data:', err);
    process.exit(1);
});
