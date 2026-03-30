import * as fs from 'fs';
import * as path from 'path';
import { formatGermanDateTime } from './date-utils';

export interface Config {
    syncQuestions: { lastSyncAt: string };
    checkEvaluation: { lastSyncAt: string };
}

const CONFIG_PATH = path.join('.', 'config.json');

function readConfig(): Config {
    const raw = fs.readFileSync(CONFIG_PATH, { encoding: 'utf8' });
    return JSON.parse(raw) as Config;
}

export function updateConfigSyncTime(pipeline: keyof Config): void {
    const config = readConfig();
    config[pipeline].lastSyncAt = formatGermanDateTime(new Date());
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8' });
    console.log(`Updated config.json: ${pipeline}.lastSyncAt = ${config[pipeline].lastSyncAt}`);
}
