import evaluationData from '../data/current-evaluation.json';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { CurrentEvaluation } from '../types/current-evaluation';

const scrapCurrentEvaluation = async () => {
    const url = 'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html';
    const pageData = await cheerio.fromURL(url);

    const currentEvaluation: CurrentEvaluation = {
        examDate: pageData('div>div.c-service-box__container>p>strong').text().trim()
    };

    return currentEvaluation;
};

export async function scrapCurrentEvaluationData() {
    try {
        const currentEvalDate = await scrapCurrentEvaluation();
        console.log('Current Evaluation Data:', currentEvalDate);
        if (currentEvalDate.examDate === '') {
            throw new Error('No current evaluation date found on the page.');
        }
        if (currentEvalDate.examDate === evaluationData.examDate) {
            console.log('No new evaluation data found, exiting.');
            return;
        }

        const dir = './data';
        const filePath = path.join(dir, 'current-evaluation.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(currentEvalDate, null, 2), { encoding: 'utf8' });
        console.log(`Data scraped and saved to ${filePath}`);

    } catch (error) {
        console.error('Error scraping data:', error);
    }

}