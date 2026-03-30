import { scrapCurrentEvaluationData } from './services/scrap-bamf-current-evaluation';
import { scrapeData } from './services/scrap-data';
import { scrapPrüfstellen } from './services/scrap-prüfstellen';
import { updateConfigSyncTime } from './services/config';

const scrapAllSources = async () => {
    await scrapeData();
    await scrapPrüfstellen();
    await scrapCurrentEvaluationData();
    updateConfigSyncTime('syncQuestions');
};

scrapAllSources().then(() => {
    console.log('Scraping completed successfully');
    process.exit(0);
}).catch((err) => {
    console.error('Error scraping data:', err);
    process.exit(1);
});
