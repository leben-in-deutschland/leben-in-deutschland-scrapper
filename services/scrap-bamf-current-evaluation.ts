import evaluationData from '../data/current-evaluation.json';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { CurrentEvaluation, EvaluationRecord } from '../types/current-evaluation';

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

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const existing: CurrentEvaluation = evaluationData as CurrentEvaluation;

        // Check if the examDate has changed since last check
        if (examDate === existing.examDate) {
            console.log('No new evaluation data found, exiting.');
            return;
        }

        // Append new record to history
        const newRecord: EvaluationRecord = {
            examDate,
            checkedAt: today
        };

        const updatedData: CurrentEvaluation = {
            examDate,
            history: [...(existing.history || []), newRecord]
        };

        const dir = './data';
        const filePath = path.join(dir, 'current-evaluation.json');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2) + '\n', { encoding: 'utf8' });
        console.log(`Evaluation date updated to ${examDate}, saved to ${filePath}`);

    } catch (error) {
        console.error('Error scraping data:', error);
    }
}
