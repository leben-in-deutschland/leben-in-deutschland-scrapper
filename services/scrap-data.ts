import { Question, QuestionTranslation } from "../types/question";
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { TARGET_LANGUAGES } from "../types/constants";
import { STATE_REVERSE_MAPPING } from "../types/state-mapping";
import { createHash } from "crypto";
import existingQuestionJson from '../data/question.json';

let questionsIndex = 0;

const generateQuestionNumber = (url: string, element: any, index: number): string => {
    const pageData = cheerio.load(element);
    const questionIdMatch = pageData(element).attr('id') || '';
    const extractedNum = questionIdMatch.match(/q(\d+)/);

    if (extractedNum && extractedNum[1]) {
        if (url.includes('/state-questions/')) {
            const urlParts = url.split('/');
            const stateNameIndex = urlParts.indexOf('state-questions') + 1;

            if (stateNameIndex < urlParts.length) {
                const stateName = urlParts[stateNameIndex];
                const stateCode = STATE_REVERSE_MAPPING[stateName];

                if (stateCode) {
                    return `${stateCode.toUpperCase()}-${extractedNum[1]}`;
                }
            }
        }

        return extractedNum[1];
    }

    if (url.includes('/state-questions/')) {
        const urlParts = url.split('/');
        const stateNameIndex = urlParts.indexOf('state-questions') + 1;

        if (stateNameIndex < urlParts.length) {
            const stateName = urlParts[stateNameIndex];
            const stateCode = STATE_REVERSE_MAPPING[stateName];

            if (stateCode) {
                return `${stateCode.toUpperCase()}-${index}`;
            }
        }
    }

    return index.toString();
};


const translateText = async (inputs: { text: string }[], from: string, to: string[]) => {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&${to.map(lang => `to=${lang}`).join('&')}`;
    console.log(`Translating text from ${from} to ${to.join(', ')}`);
    const headers = {
        'Ocp-Apim-Subscription-Key': process.env.TRANSLATOR_KEY || '',
        'Ocp-Apim-Subscription-Region': "swedencentral",
        'Content-Type': 'application/json'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(inputs)
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Error translating text:', err);
        throw err;
    }
}

const translate = async (question: Question) => {
    try {
        console.log(`Translating question ${question.num}`);
        const translations: { [key: string]: QuestionTranslation } = {};
        const inputs = [
            { text: question.question },
            { text: question.a },
            { text: question.b },
            { text: question.c },
            { text: question.d },
            { text: question.context }
        ];

        const translatedResults = await translateText(inputs, 'de', TARGET_LANGUAGES);
        for (const lang of TARGET_LANGUAGES) {
            console.log(`Translating to ${lang}`);
            translations[lang] = {
                question: translatedResults[0].translations.find((t: any) => t.to === lang)?.text || '',
                a: translatedResults[1].translations.find((t: any) => t.to === lang)?.text || '',
                b: translatedResults[2].translations.find((t: any) => t.to === lang)?.text || '',
                c: translatedResults[3].translations.find((t: any) => t.to === lang)?.text || '',
                d: translatedResults[4].translations.find((t: any) => t.to === lang)?.text || '',
                context: translatedResults[5].translations.find((t: any) => t.to === lang)?.text || ''
            };
        }
        return translations;
    } catch (err) {
        console.error('Error processing questions:', err);
    }
};

const generateId = (question: Question) => {
    const text = question.question + question.a + question.b + question.c + question.d;
    const crypt = createHash('sha256').update(text).digest('hex')
    return crypt;
};


async function getContext(question: Question) {
    const systemPromptTemplate = `You are given a task to find context for below question. \
    Give context so that it will help understand the question.\
    The generated text should not be more then 100 words.\
    Always generate in german language.\
    <Question> \
        Question - ${question.question}\
        a:   ${question.a}\
        b:   ${question.b}\
        c:   ${question.c}\
        d:   ${question.d}\
    </Question>`;
    const url = process.env.AI_URL;
    const headers = {
        'api-key': process.env.AI_KEY,
        'Content-Type': 'application/json'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": systemPromptTemplate
                    }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const context = data.choices[0].message.content;
        console.log(`Fetched Context ${question.num}`);
        return context;
    } catch (err) {
        console.error('Error Context:', err);
        return "General";
    }
}


async function findCategory(question: Question): Promise<"Rights & Freedoms" |
    "Education & Religion" |
    "Law & Governance" |
    "Democracy & Politics" |
    "Economy & Employment" |
    "History & Geography" |
    "Elections" |
    "Press Freedom" |
    "Assembly & Protests" |
    "Federal System" |
    "Constitution" |
    "General"> {
    const systemPromptTemplate = `You are given a task to find category for below question. \
    Your response should be only category from below list.\
    'Rights & Freedoms', 'Education & Religion', 'Law & Governance',\
    'Democracy & Politics', 'Economy & Employment', 'History & Geography',\
    'Elections', 'Press Freedom', 'Assembly & Protests', 'Federal System', 'Constitution'\
    <Question> \
    Question - ${question.question}\
    a:   ${question.a}\
    b:   ${question.b}\
    c:   ${question.c}\
    d:   ${question.d}\
    </Question>`;
    const url = process.env.AI_URL;
    const headers = {
        'api-key': process.env.AI_KEY,
        'Content-Type': 'application/json'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": systemPromptTemplate
                    }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const category = data.choices[0].message.content;
        console.log(`Found category for question ${question.num}: ${category}`);
        return category;
    } catch (err) {
        console.error('Error Category:', err);
        return "General";
    }
}

const scrap = async (url: string, state: string) => {
    const questions: Question[] = [];
    const pageData = await cheerio.fromURL(url);

    const newStyleQuestions = pageData('div.card.question-container');

    console.log(`Scraping ${url} and found ${newStyleQuestions.length} questions`);

    // Reset questions index if this is a state URL
    if (url.includes('/state-questions/')) {
        questionsIndex = 0;
    }

    newStyleQuestions.each((_, element) => {
        questionsIndex++;

        // Generate question number based on URL and element
        let num = generateQuestionNumber(url, element, questionsIndex);

        let question: Question = {
            num: num,
            question: '',
            a: '',
            b: '',
            c: '',
            d: '',
            solution: '',
            image: '-',
            translation: {},
            category: null,
            context: '',
            id: ''
        };

        question.question = pageData(element).find(".question-text h5").text().trim();

        const imageClasses = [
            ".question-image-square-large",
            ".question-image-square",
            ".question-image-rectangle",
            ".question-image-horizontal",
            ".question-image-vertical"
        ];

        let foundImage = false;
        for (const imageClass of imageClasses) {
            if (pageData(element).find(imageClass).length > 0) {
                const imgSrc = pageData(element).find(imageClass).attr('src');
                if (imgSrc) {
                    question.image = imgSrc.startsWith('/')
                        ? `${process.env.BASE_URL}${imgSrc}`
                        : imgSrc;
                    foundImage = true;
                    break;
                }
            }
        }

        pageData(element).find(".card-body ul li.choice").each((_, choiceElement) => {
            const option = pageData(choiceElement).find(".option").text().trim().toLowerCase();
            const choiceText = pageData(choiceElement).find(".choice-text").text().trim();

            if (option && question[option] !== undefined) {
                question[option] = choiceText;

                if (pageData(choiceElement).find(".answer-indicator").length > 0) {
                    question.solution = option;
                }
            }
        });

        questions.push(question);
    });

    return questions;
};

const fetchSitemap = async () => {
    const sitemapUrl = `${process.env.BASE_URL}/sitemap.xml`;
    const res = await fetch(sitemapUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
    }
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $('url > loc').each((_, element) => {
        const url = $(element).text();
        if (/\/leben-in-deutschland-test\/(?!practice-test)/.test(url)) {
            urls.push(url);
        }
    });
    return urls;
};

const scrapAll = async () => {
    let questions: Question[] = [];
    const links = await fetchSitemap();
    console.log(`Scraping ${links.length} links`);
    for (let i = 0; i < links.length; i++) {
        const tempQuestions = await scrap(links[i], "")
        questions = [...questions, ...tempQuestions];
    }
    return questions;
}

export async function scrapeData() {
    try {
        const oldQuestion = JSON.parse(JSON.stringify(existingQuestionJson)) as Question[]
        let allQuestion = await scrapAll();

        for (let i = 0; i < allQuestion.length; i++) {
            if (!allQuestion[i].question) {
                continue;
            }
            allQuestion[i].id = generateId(allQuestion[i]);
            const existing = oldQuestion.findIndex((q) => q && q.id === allQuestion[i].id);
            if (existing !== -1) {
                allQuestion[i].translation = oldQuestion[existing].translation;
                allQuestion[i].category = oldQuestion[existing].category;
                allQuestion[i].context = oldQuestion[existing].context;
            } else {
                allQuestion[i].category = await findCategory(allQuestion[i]);
                allQuestion[i].context = await getContext(allQuestion[i]);
                allQuestion[i].translation = await translate(allQuestion[i]);
            }
        }
        const dir = './data';
        const filePath = path.join(dir, 'question.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(allQuestion, null, 2), { encoding: 'utf8' });
        console.log(`Data scraped and saved to ${filePath}`);
    } catch (error) {
        console.error('Error scraping data:', error);
    }
}