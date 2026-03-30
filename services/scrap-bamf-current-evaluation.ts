import evaluationData from '../data/current-evaluation.json';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { CurrentEvaluation, EvaluationRecord } from '../types/current-evaluation';
import { formatGermanDate, formatGermanDateTime } from './date-utils';

const scrapCurrentEvaluation = async (): Promise<string> => {
    const url = 'https://www.bamf.de/DE/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html';
    const pageData = await cheerio.fromURL(url);
    return pageData('div>div.c-service-box__container>p>strong').text().trim();
};

export async function scrapCurrentEvaluationData() {
    try {
        const examDate = await scrapCurrentEvaluation();
        console.log('Current Evaluation Date:', examDate);

        if (examDate === '') {
            throw new Error('No current evaluation date found on the page.');
        }

        const now = new Date();
        const existing: CurrentEvaluation = evaluationData as CurrentEvaluation;

        const dateChanged = examDate !== existing.examDate;

        // Build updated data — always update lastSyncAt, append history only on date change
        const updatedData: CurrentEvaluation = {
            examDate,
            lastSyncAt: formatGermanDateTime(now),
            history: dateChanged
                ? [...(existing.history || []), { examDate, checkedAt: formatGermanDate(now) }]
                : existing.history || []
        };

        const dir = './data';
        const filePath = path.join(dir, 'current-evaluation.json');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2) + '\n', { encoding: 'utf8' });

        if (dateChanged) {
            console.log(`Evaluation date updated to ${examDate}, saved to ${filePath}`);
        } else {
            console.log(`No new evaluation data, lastSyncAt updated in ${filePath}`);
        }

    } catch (error) {
        console.error('Error scraping data:', error);
    }
}
