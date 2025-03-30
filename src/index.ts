import { scrapeData } from './services/scrap-data';
import { scrapPrüfstellen } from './services/scrap-prüfstellen';

const scrapAllSources = async () => {
    await scrapeData();
    await scrapPrüfstellen();
};

scrapAllSources().then(() => {
    console.log('Scraping completed successfully');
    process.exit(0);
}).catch((err) => {
    console.error('Error scraping data:', err);
    process.exit(1);
});
