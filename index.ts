import { scrapCurrentEvaluationData } from './services/scrap-bamf-current-evaluation';
import { scrapeData } from './services/scrap-data';
import { scrapPrüfstellen } from './services/scrap-prüfstellen';

const scrapAllSources = async () => {
    await scrapeData();
    await scrapPrüfstellen();
    await scrapCurrentEvaluationData();
};

scrapAllSources().then(() => {
    console.log('Scraping completed successfully');
    process.exit(0);
}).catch((err) => {
    console.error('Error scraping data:', err);
    process.exit(1);
});
