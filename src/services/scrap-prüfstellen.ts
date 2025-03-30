import { BASE_URL_BAMF, STATES } from "../types/constants";
import { Prüfstellen } from "../types/prüfstellen";
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

async function scrapPrüfstellenForState(stateCode: string): Promise<Prüfstellen[]> {
    let allPrüfstellen = [];
    const page = `${BASE_URL_BAMF}/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-${stateCode.toUpperCase()}.xlsx`;
    const $ = await cheerio.fromURL(page);
    let links = [];
    $('ul>li>a.c-link.c-link--download.c-link--desc.c-link--orient').each((_, element) => {
        const href = $(element).attr('href');
        const url = `${BASE_URL_BAMF}${href}`;
        links.push(url);
    });

    for (let i = 0; i < links.length; i++) {
        const resp = await fetch(links[i]);
        if (!resp.ok) {
            console.log(`Error fetching ${links[i]}`);
            continue;
        }
        const blob = await resp.blob();
        const text = await blob.arrayBuffer();
        const workbook = XLSX.read(text, { type: "binary" });

        for (let sheet in workbook.Sheets) {
            let worksheet = workbook.Sheets[sheet];
            let rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1, blankrows: false, skipHidden: true, defval: "" });
            for (let i = 1; i < rows.length; i++) {
                const prüfstelle = {
                    regierungsbezirk: !rows[i][0] ? (rows[i][0] + " ") : "" + rows[i][1],
                    plz: rows[i][2],
                    ort: rows[i][3],
                    einrichtung: rows[i][4],
                    straße: rows[i][5],
                    telefon: rows[i][6],
                    email: rows[i][7],
                };
                allPrüfstellen.push(prüfstelle);
            }
        }
    }
    return allPrüfstellen;
}

export async function scrapPrüfstellen() {
    try {
        let allPrüfstellen = [];
        for (let i = 0; i < STATES.length; i++) {
            const data = (await scrapPrüfstellenForState(STATES[i]))
                .filter((x) => (!x.regierungsbezirk.startsWith("Stand")))
                .filter((x) => x.einrichtung !== "");

            data.shift();

            allPrüfstellen.push({
                "stateCode": STATES[i], "data": data
            });
        }
        const dir = './data';
        const filePath = path.join(dir, 'prüfstellen.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(allPrüfstellen, null, 2), { encoding: 'utf8' });
        console.log(`Data scraped and saved to ${filePath}`);

    } catch (error) {
        console.error('Error scraping data:', error);
    }

}