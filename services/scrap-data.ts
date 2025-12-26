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
                    // For state questions, ensure the number is between 1-10
                    let stateQuestionNum = parseInt(extractedNum[1]);
                    if (stateQuestionNum > 10) {
                        console.warn(`⚠️ [Generator] State ${stateCode.toUpperCase()} question number ${stateQuestionNum} exceeds expected range (1-10)`);
                        // Cap it at 10
                        stateQuestionNum = Math.min(stateQuestionNum, 10);
                    }
                    return `${stateCode.toUpperCase()}-${stateQuestionNum}`;
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
                // Use index for proper 1-10 numbering per state (index resets for each state)
                if (index > 10) {
                    console.warn(`⚠️ [Generator] State ${stateCode.toUpperCase()} has more than 10 questions (question ${index}). This might indicate duplicate content or parsing issues.`);
                    // Cap it at 10
                    return `${stateCode.toUpperCase()}-10`;
                }

                return `${stateCode.toUpperCase()}-${index}`;
            }
        }
    }

    return index.toString();
};


const translateText = async (inputs: { text: string }[], from: string, to: string[]) => {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&${to.map(lang => `to=${lang}`).join('&')}`;
    console.log(`📡 [Translation API] Translating ${inputs.length} texts from ${from} to ${to.join(', ')}`);
    console.log(`🔍 [Translation API] Input texts:`, inputs.map((input, i) => `[${i}]: "${input.text.substring(0, 50)}..."`));
    const startTime = Date.now();

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
            console.error(`❌ [Translation API] Failed with status ${response.status}: ${response.statusText}`);
            const errorText = await response.text();
            console.error(`🔍 [Translation API] Error response body:`, errorText);
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`🔍 [Translation API] Response structure:`, {
            resultCount: data.length,
            firstResult: data[0] ? {
                translationsCount: data[0].translations?.length,
                sampleTranslation: data[0].translations?.[0]
            } : 'No results'
        });

        const duration = Date.now() - startTime;
        console.log(`✅ [Translation API] Successfully translated in ${duration}ms`);
        return data;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Translation API] Error after ${duration}ms:`, err);
        throw err;
    }
}

const translate = async (question: Question) => {
    const startTime = Date.now();
    console.log(`🔤 [Translation] Starting translation for question ${question.num}`);

    try {
        const translations: { [key: string]: QuestionTranslation } = {};

        // Log the original context but don't modify it yet
        if (!question.context || question.context.trim().length === 0) {
            console.warn(`⚠️ [Translation] Context is empty for question ${question.num} before translation`);
            console.warn(`⚠️ [Translation] This might indicate context generation failed earlier`);
        } else {
            console.log(`✅ [Translation] Context found for question ${question.num}: "${question.context}"`);
        }

        const inputs = [
            { text: question.question },
            { text: question.a },
            { text: question.b },
            { text: question.c },
            { text: question.d },
            { text: question.context } // Don't use fallback - let it be empty if context is missing
        ];

        console.log(`🔍 [Translation] Context being translated: "${inputs[5].text || 'EMPTY CONTEXT'}"`);

        const translatedResults = await translateText(inputs, 'de', TARGET_LANGUAGES);        // Check if translation results are valid
        if (!translatedResults || !Array.isArray(translatedResults) || translatedResults.length === 0) {
            console.warn(`⚠️ [Translation] Empty or invalid translation results for question ${question.num}`);
            return null;
        }

        for (const lang of TARGET_LANGUAGES) {
            console.log(`🌐 [Translation] Processing ${lang} for question ${question.num}`);

            // Extract translations with detailed logging
            const questionTranslation = translatedResults[0]?.translations?.find((t: any) => t.to === lang);
            const aTranslation = translatedResults[1]?.translations?.find((t: any) => t.to === lang);
            const bTranslation = translatedResults[2]?.translations?.find((t: any) => t.to === lang);
            const cTranslation = translatedResults[3]?.translations?.find((t: any) => t.to === lang);
            const dTranslation = translatedResults[4]?.translations?.find((t: any) => t.to === lang);
            const contextTranslation = translatedResults[5]?.translations?.find((t: any) => t.to === lang);

            // Debug context translation specifically
            if (!contextTranslation || !contextTranslation.text) {
                console.error(`🔍 [Translation DEBUG] Context translation issue for question ${question.num} in ${lang}:`);
                console.error(`   • Original context: "${question.context}"`);
                console.error(`   • Context input sent: "${inputs[5].text}"`);
                console.error(`   • Context input index: 5`);
                console.error(`   • Translation result [5]:`, translatedResults[5]);
                console.error(`   • Available translations for [5]:`, translatedResults[5]?.translations);
                console.error(`   • Looking for language: ${lang}`);
                console.error(`   • Found translation:`, contextTranslation);
            } else {
                console.log(`🔍 [Translation DEBUG] Context successfully translated for question ${question.num} in ${lang}: "${contextTranslation.text.substring(0, 100)}..."`);
            }

            translations[lang] = {
                question: questionTranslation?.text || '',
                a: aTranslation?.text || '',
                b: bTranslation?.text || '',
                c: cTranslation?.text || '',
                d: dTranslation?.text || '',
                context: contextTranslation?.text || '' // Keep empty if translation fails
            };

            // Use fallback context only if the original context was empty AND translation failed
            if (!translations[lang].context && (!question.context || question.context.trim().length === 0)) {
                // Only use fallback if original context was missing
                const fallbacks: { [key: string]: string } = {
                    'en': 'General question about life in Germany',
                    'tr': 'Almanya\'da yaşam hakkında genel soru',
                    'ar': 'سؤال عام حول الحياة في ألمانيا',
                    'hi': 'जर्मनी में जीवन के बारे में सामान्य प्रश्न',
                    'fr': 'Question générale sur la vie en Allemagne',
                    'es': 'Pregunta general sobre la vida en Alemania'
                };
                translations[lang].context = fallbacks[lang] || 'General question about life in Germany';
                console.log(`🔄 [Translation] Using fallback context for ${lang} since original was empty`);
            }

            // Log if any translation fields are empty
            const emptyFields = [];
            if (!translations[lang].question) emptyFields.push('question');
            if (!translations[lang].a) emptyFields.push('choice A');
            if (!translations[lang].b) emptyFields.push('choice B');
            if (!translations[lang].c) emptyFields.push('choice C');
            if (!translations[lang].d) emptyFields.push('choice D');
            if (!translations[lang].context) emptyFields.push('context');

            if (emptyFields.length > 0) {
                console.warn(`⚠️ [Translation] Empty translations for question ${question.num} in ${lang}: ${emptyFields.join(', ')}`);

                // Additional debug for context specifically
                if (emptyFields.includes('context')) {
                    console.error(`🔍 [Translation DEBUG] Context field analysis:`);
                    console.error(`   • Original context length: ${question.context?.length || 0}`);
                    console.error(`   • Original context: "${question.context}"`);
                    console.error(`   • Input sent to API: "${inputs[5].text}"`);
                    console.error(`   • Translation API response for context:`, contextTranslation);
                    console.error(`   • Full translation result [5]:`, translatedResults[5]);
                }
            } else {
                console.log(`✅ [Translation] All fields translated successfully for question ${question.num} in ${lang}`);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Translation] Completed question ${question.num} in ${duration}ms`);
        return translations;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Translation] Failed for question ${question.num} after ${duration}ms:`, err);
        return null;
    }
};

const generateId = (question: Question) => {
    const text = question.question + question.a + question.b + question.c + question.d;
    const crypt = createHash('sha256').update(text).digest('hex')
    return crypt;
};


async function parseQuestionWithAI(questionText: string, html: string, rawText: string, questionNum: string) {
    const startTime = Date.now();
    console.log(`🤖 [AI Parser] Parsing question ${questionNum} with AI`);

    const systemPrompt = `You are an expert HTML parser for German citizenship test questions. 
    You need to extract the question choices (A, B, C, D) and identify the correct answer from the provided HTML and text content.

    Look for:
    1. Four answer choices labeled A, B, C, D (or a, b, c, d)
    2. The correct answer marked with a checkmark emoji ✅ or other indicators
    3. Clean choice text without HTML tags or extra formatting

    Return ONLY a valid JSON object in this exact format:
    {
        "choices": {
            "a": "text for choice A",
            "b": "text for choice B", 
            "c": "text for choice C",
            "d": "text for choice D"
        },
        "solution": "a|b|c|d"
    }

    Question: "${questionText}"
    
    Raw Text Content:
    ${rawText.substring(0, 2000)}
    
    HTML Content (first 1500 chars):
    ${html.substring(0, 1500)}`;

    const url = process.env.AI_URL || '';
    const headers = {
        'api-key': process.env.AI_KEY || '',
        'Content-Type': 'application/json'
    };

    try {
        if (!url || !process.env.AI_KEY) {
            console.warn(`⚠️ [AI Parser] Missing AI_URL or AI_KEY for question ${questionNum}`);
            return null;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": systemPrompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const duration = Date.now() - startTime;
            console.error(`❌ [AI Parser] Failed for question ${questionNum} after ${duration}ms with status ${response.status}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.warn(`⚠️ [AI Parser] Empty response for question ${questionNum}`);
            return null;
        }

        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            content = jsonMatch[0];
        }

        const parsedResult = JSON.parse(content);

        // Validate the result structure
        if (!parsedResult.choices ||
            !parsedResult.choices.a ||
            !parsedResult.choices.b ||
            !parsedResult.choices.c ||
            !parsedResult.choices.d) {
            console.warn(`⚠️ [AI Parser] Invalid response structure for question ${questionNum}`);
            return null;
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [AI Parser] Successfully parsed question ${questionNum} in ${duration}ms`);

        return parsedResult;

    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`💥 [AI Parser] Error parsing question ${questionNum} after ${duration}ms:`, err);
        return null;
    }
}

async function getContext(question: Question) {
    const startTime = Date.now();
    console.log(`📝 [Context API] Generating context for question ${question.num}`);

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

    const url = process.env.AI_URL || '';
    const headers = {
        'api-key': process.env.AI_KEY || '',
        'Content-Type': 'application/json'
    };

    try {
        if (!url || !process.env.AI_KEY) {
            console.warn(`⚠️ [Context API] Missing AI_URL or AI_KEY for question ${question.num}`);
            return "Allgemeine Frage zum Leben in Deutschland";
        }

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
            const duration = Date.now() - startTime;
            console.error(`❌ [Context API] Failed for question ${question.num} after ${duration}ms with status ${response.status}: ${response.statusText}`);
            console.log(`🔄 [Context API] Using fallback context for question ${question.num}`);
            return "Frage zum deutschen Gesellschafts- und Rechtssystem";
        }

        const data = await response.json();
        const context = data.choices?.[0]?.message?.content;

        if (!context || context.trim().length === 0) {
            console.warn(`⚠️ [Context API] Empty context returned for question ${question.num}`);
            return "Relevante Frage für das Leben in Deutschland";
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Context API] Generated context for question ${question.num} in ${duration}ms: "${context.substring(0, 50)}..."`);
        return context;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Context API] Error for question ${question.num} after ${duration}ms:`, err);
        console.log(`🔄 [Context API] Using fallback context for question ${question.num}`);
        return "Wichtige Frage für das Leben in Deutschland";
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
    const startTime = Date.now();
    console.log(`🏷️ [Category API] Finding category for question ${question.num}`);

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

    const url = process.env.AI_URL || '';
    const headers = {
        'api-key': process.env.AI_KEY || '',
        'Content-Type': 'application/json'
    };

    try {
        if (!url || !process.env.AI_KEY) {
            console.warn(`⚠️ [Category API] Missing AI_URL or AI_KEY for question ${question.num}`);
            return "General";
        }

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
            const duration = Date.now() - startTime;
            console.error(`❌ [Category API] Failed for question ${question.num} after ${duration}ms with status ${response.status}: ${response.statusText}`);
            console.log(`🔄 [Category API] Using fallback category for question ${question.num}`);
            return "General";
        }

        const data = await response.json();
        const category = data.choices?.[0]?.message?.content;

        if (!category || category.trim().length === 0) {
            console.warn(`⚠️ [Category API] Empty category returned for question ${question.num}`);
            return "General";
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Category API] Found category "${category}" for question ${question.num} in ${duration}ms`);
        return category;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Category API] Error for question ${question.num} after ${duration}ms:`, err);
        console.log(`🔄 [Category API] Using fallback category for question ${question.num}`);
        return "General";
    }
}

const scrap = async (url: string, state: string) => {
    const startTime = Date.now();
    console.log(`🌐 [Scraper] Starting to scrape: ${url}`);

    const questions: Question[] = [];

    try {
        const pageData = await cheerio.fromURL(url);
        const newStyleQuestions = pageData('div.card.question-container');

        console.log(`📄 [Scraper] Found ${newStyleQuestions.length} questions on ${url}`);

        // Reset questions index if this is a state URL
        if (url.includes('/state-questions/')) {
            questionsIndex = 0;
            console.log(`🏛️ [Scraper] Processing state questions, reset index`);
        }

        // Convert cheerio elements to array and process them sequentially
        const questionElements: any[] = [];
        newStyleQuestions.each((_, element) => {
            questionElements.push(element);
        });

        for (const [index, element] of questionElements.entries()) {
            questionsIndex++;
            console.log(`📋 [Scraper] Processing question ${questionsIndex}/${questionElements.length} from ${url}`);

            // Generate question number based on URL and element
            let num = generateQuestionNumber(url, element, questionsIndex);
            console.log(`🔢 [Scraper] Generated question number: ${num}`);

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

            if (!question.question) {
                console.warn(`⚠️ [Scraper] Empty question text for question ${num}`);
            } else {
                console.log(`📝 [Scraper] Extracted question text for ${num}: "${question.question.substring(0, 50)}..."`);
            }

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
                        console.log(`🖼️ [Scraper] Found image for question ${num}: ${question.image}`);
                        break;
                    }
                }
            }

            if (!foundImage) {
                console.log(`📷 [Scraper] No image found for question ${num}`);
            }

            // AI-powered HTML parsing approach
            let choicesFound = false;

            console.log(`🤖 [AI Parser] Using AI to extract choices for question ${num}`);

            try {
                // Extract the raw HTML content and text of the question element
                const rawHTML = pageData(element).html() || '';
                const rawText = pageData(element).text();

                // Use AI to parse the question data
                const aiResult = await parseQuestionWithAI(question.question, rawHTML, rawText, num);

                if (aiResult && aiResult.choices && Object.keys(aiResult.choices).length >= 4) {
                    question.a = aiResult.choices.a || '';
                    question.b = aiResult.choices.b || '';
                    question.c = aiResult.choices.c || '';
                    question.d = aiResult.choices.d || '';
                    question.solution = aiResult.solution || '';

                    choicesFound = true;
                    console.log(`✅ [AI Parser] Successfully extracted choices for question ${num}`);
                    console.log(`📝 [AI Parser] Choice A: "${question.a.substring(0, 30)}..."`);
                    console.log(`📝 [AI Parser] Choice B: "${question.b.substring(0, 30)}..."`);
                    console.log(`📝 [AI Parser] Choice C: "${question.c.substring(0, 30)}..."`);
                    console.log(`📝 [AI Parser] Choice D: "${question.d.substring(0, 30)}..."`);
                    if (question.solution) {
                        console.log(`✅ [AI Parser] Found correct answer: ${question.solution.toUpperCase()} for question ${num}`);
                    } else {
                        console.warn(`⚠️ [AI Parser] No solution detected for question ${num}`);
                    }
                } else {
                    console.warn(`⚠️ [AI Parser] Failed to extract valid choices for question ${num}, falling back to manual methods`);
                }
            } catch (error) {
                console.error(`💥 [AI Parser] Error parsing question ${num}:`, error);
                console.log(`🔄 [AI Parser] Falling back to manual methods for question ${num}`);
            }

            // Fallback: Use traditional parsing methods if AI parsing fails
            if (!choicesFound) {
                console.log(`🔧 [Fallback] Using traditional parsing methods for question ${num}`);

                // Method 1: Original structure - .card-body ul li.choice with .option and .choice-text
                pageData(element).find(".card-body ul li.choice").each((_, choiceElement) => {
                    const option = pageData(choiceElement).find(".option").text().trim().toLowerCase();
                    const choiceText = pageData(choiceElement).find(".choice-text").text().trim();

                    if (option && (option === 'a' || option === 'b' || option === 'c' || option === 'd')) {
                        question[option] = choiceText;
                        choicesFound = true;
                        console.log(`📝 [Fallback] Choice ${option.toUpperCase()}: "${choiceText.substring(0, 30)}..."`);

                        // Look for checkmark emoji
                        if (choiceText.includes('✅') || pageData(choiceElement).text().includes('✅')) {
                            question.solution = option;
                            console.log(`✅ [Fallback] Found correct answer: ${option.toUpperCase()} for question ${num}`);
                        }
                    }
                });

                // Method 2: Direct text parsing if method 1 fails
                if (!choicesFound) {
                    const potentialChoices = pageData(element).find('p, div').filter((_, el) => {
                        const text = pageData(el).text().trim();
                        return /^[ABCD]\s/.test(text);
                    });

                    potentialChoices.each((_, choiceEl) => {
                        const fullText = pageData(choiceEl).text().trim();
                        const match = fullText.match(/^([ABCD])\s(.+)$/);

                        if (match) {
                            const option = match[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
                            let choiceText = match[2];
                            const hasCheckmark = choiceText.includes('✅');
                            choiceText = choiceText.replace('✅', '').trim();

                            question[option] = choiceText;
                            choicesFound = true;
                            console.log(`📝 [Fallback] Choice ${option.toUpperCase()}: "${choiceText.substring(0, 30)}..."`);

                            if (hasCheckmark) {
                                question.solution = option;
                                console.log(`✅ [Fallback] Found correct answer: ${option.toUpperCase()} for question ${num}`);
                            }
                        }
                    });
                }
            }



            // Final validation - check if we found any choices
            if (!choicesFound) {
                console.error(`❌ [Scraper] No choices found for question ${num}`);
                console.error(`🔍 [Scraper] Debug info for question ${num}:`);
                console.error(`   • Question text: "${question.question}"`);
                console.error(`   • URL: ${url}`);
                console.error(`   • Element HTML structure (first 500 chars):`, pageData(element).html()?.substring(0, 500) + '...');

                // Try to find any text that looks like choices
                const allText = pageData(element).text();
                const choicePattern = /[ABCD]\s+.+/g;
                const potentialChoices = allText.match(choicePattern);
                if (potentialChoices) {
                    console.error(`   • Potential choice patterns found:`, potentialChoices);
                } else {
                    console.error(`   • No choice patterns found in text`);
                }
            }

            // Final check: If no solution was found, log detailed debug info
            if (!question.solution && choicesFound) {
                console.warn(`⚠️ [Scraper] No solution found for question ${num} (but choices were found)`);
                console.warn(`🔍 [Scraper] Debug info for question ${num}:`);

                // Log the HTML structure for debugging
                const choicesHtml = pageData(element).find(".card-body ul li.choice, p, div").filter((_, el) => {
                    return /[ABCD]/.test(pageData(el).text());
                }).map((_, el) => {
                    const $el = pageData(el);
                    return {
                        text: $el.text().trim(),
                        classes: $el.attr('class'),
                        style: $el.attr('style'),
                        html: $el.html()?.substring(0, 200) + '...'
                    };
                }).get();

                console.warn(`   • Choices structure:`, choicesHtml);
                console.warn(`   • URL: ${url}`);
                console.warn(`   • Question: "${question.question.substring(0, 100)}..."`);
            }

            questions.push(question);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Scraper] Completed scraping ${url} - extracted ${questions.length} questions in ${duration}ms`);
        return questions;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Scraper] Failed to scrape ${url} after ${duration}ms:`, error);
        return questions; // Return whatever questions we managed to extract
    }
};

const fetchSitemap = async () => {
    const startTime = Date.now();
    const sitemapUrl = `${process.env.BASE_URL}/sitemap.xml`;
    console.log(`🗺️ [Sitemap] Fetching sitemap from: ${sitemapUrl}`);

    try {
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

        const duration = Date.now() - startTime;
        console.log(`✅ [Sitemap] Found ${urls.length} relevant URLs in ${duration}ms`);
        console.log(`📋 [Sitemap] Sample URLs: ${urls.slice(0, 3).join(', ')}${urls.length > 3 ? '...' : ''}`);

        return urls;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`💥 [Sitemap] Failed to fetch sitemap after ${duration}ms:`, error);
        throw error;
    }
};

const scrapAll = async () => {
    const overallStartTime = Date.now();
    console.log(`🚀 [ScrapAll] Starting to scrape all questions`);

    const links = await fetchSitemap();
    console.log(`📊 [ScrapAll] Total links to process: ${links.length}`);

    // Process URLs in parallel with a concurrency limit to avoid overwhelming the server
    const BATCH_SIZE = 5; // Process 5 URLs at a time
    const questions: Question[] = [];
    const totalBatches = Math.ceil(links.length / BATCH_SIZE);

    for (let i = 0; i < links.length; i += BATCH_SIZE) {
        const batchStartTime = Date.now();
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        const batch = links.slice(i, i + BATCH_SIZE);

        console.log(`\n📦 [ScrapAll] Processing batch ${currentBatch}/${totalBatches} (${batch.length} URLs)`);
        console.log(`🔗 [ScrapAll] Batch URLs: ${batch.join(', ')}`);

        try {
            const batchPromises = batch.map(link => scrap(link, ""));
            const batchResults = await Promise.all(batchPromises);

            // Flatten and add all questions from this batch
            let batchQuestionCount = 0;
            batchResults.forEach(tempQuestions => {
                batchQuestionCount += tempQuestions.length;
                questions.push(...tempQuestions);
            });

            const batchDuration = Date.now() - batchStartTime;
            console.log(`✅ [ScrapAll] Batch ${currentBatch} completed in ${batchDuration}ms - extracted ${batchQuestionCount} questions`);
            console.log(`📈 [ScrapAll] Total questions so far: ${questions.length}`);

        } catch (error) {
            const batchDuration = Date.now() - batchStartTime;
            console.error(`💥 [ScrapAll] Batch ${currentBatch} failed after ${batchDuration}ms:`, error);
        }
    }

    const overallDuration = Date.now() - overallStartTime;
    console.log(`\n🎉 [ScrapAll] Scraping completed! Total: ${questions.length} questions in ${overallDuration}ms`);
    console.log(`⚡ [ScrapAll] Average: ${(overallDuration / questions.length).toFixed(2)}ms per question`);

    return questions;
}

export async function scrapeData() {
    const scriptStartTime = Date.now();
    console.log(`\n🎯 [ScrapeData] Starting complete data scraping process`);
    console.log(`📅 [ScrapeData] Timestamp: ${new Date().toISOString()}`);

    try {
        console.log(`📚 [ScrapeData] Loading existing questions from JSON...`);
        const oldQuestion = JSON.parse(JSON.stringify(existingQuestionJson)) as Question[];
        console.log(`✅ [ScrapeData] Loaded ${oldQuestion.length} existing questions`);

        let allQuestion = await scrapAll();
        console.log(`\n📊 [ScrapeData] Starting question processing for ${allQuestion.length} questions`);

        // Process questions in parallel
        const processQuestion = async (question: Question, index: number) => {
            const questionStartTime = Date.now();
            console.log(`🔄 [ProcessQuestion] Processing question ${index + 1}/${allQuestion.length}: ${question.num}`);

            if (!question.question) {
                console.log(`⏭️ [ProcessQuestion] Skipping empty question ${question.num}`);
                return question;
            }

            question.id = generateId(question);
            const existing = oldQuestion.findIndex((q) => q && q.id === question.id);

            if (existing !== -1) {
                console.log(`♻️ [ProcessQuestion] Found existing data for question ${question.num} - reusing`);
                question.translation = oldQuestion[existing].translation;
                question.category = oldQuestion[existing].category;
                question.context = oldQuestion[existing].context;
            } else {
                console.log(`🆕 [ProcessQuestion] New question ${question.num} - processing with APIs`);

                const apiStartTime = Date.now();

                // First, generate context and category in parallel
                console.log(`🔄 [ProcessQuestion] Step 1: Generating context and category for question ${question.num}`);
                const [category, context] = await Promise.all([
                    findCategory(question),
                    getContext(question)
                ]);

                // Set the context before translation
                question.category = category;
                question.context = context;

                // Validate that context was properly generated
                if (!question.context || question.context.trim().length === 0) {
                    console.warn(`⚠️ [ProcessQuestion] Context generation failed for question ${question.num}, setting fallback`);
                    question.context = "Relevante Frage für das Leben in Deutschland";
                } else {
                    console.log(`✅ [ProcessQuestion] Context generated for question ${question.num}: "${question.context.substring(0, 100)}..."`);
                }

                // Now translate with the proper context
                console.log(`🔄 [ProcessQuestion] Step 2: Translating question ${question.num} with context`);
                const translation = await translate(question);
                question.translation = translation;

                const apiDuration = Date.now() - apiStartTime;

                // Log translation status
                if (!question.translation) {
                    console.warn(`⚠️ [ProcessQuestion] Translation failed for question ${question.num}`);
                } else {
                    const translatedLangs = Object.keys(question.translation);
                    console.log(`✅ [ProcessQuestion] Translation completed for question ${question.num} in ${translatedLangs.length} languages: ${translatedLangs.join(', ')}`);
                }

                console.log(`🏁 [ProcessQuestion] Completed API calls for question ${question.num} in ${apiDuration}ms`);
            }

            const questionDuration = Date.now() - questionStartTime;
            console.log(`✅ [ProcessQuestion] Finished processing question ${question.num} in ${questionDuration}ms`);
            return question;
        };

        // Process all questions with concurrency limit
        const QUESTION_BATCH_SIZE = 3; // Process 3 questions at a time to avoid API rate limits
        const processedQuestions: Question[] = [];
        const totalQuestionBatches = Math.ceil(allQuestion.length / QUESTION_BATCH_SIZE);
        let newQuestionsCount = 0;
        let existingQuestionsCount = 0;

        for (let i = 0; i < allQuestion.length; i += QUESTION_BATCH_SIZE) {
            const batchStartTime = Date.now();
            const currentBatch = Math.floor(i / QUESTION_BATCH_SIZE) + 1;
            const batch = allQuestion.slice(i, i + QUESTION_BATCH_SIZE);

            console.log(`\n📦 [ScrapeData] Processing question batch ${currentBatch}/${totalQuestionBatches}`);
            console.log(`📋 [ScrapeData] Batch questions: ${batch.map(q => q.num).join(', ')}`);

            const batchPromises = batch.map((question, index) => processQuestion(question, i + index));
            const batchResults = await Promise.all(batchPromises);

            // Count new vs existing
            batch.forEach(q => {
                const existing = existingQuestionJson.findIndex((eq: any) => eq && eq.id === generateId(q));
                if (existing !== -1) {
                    existingQuestionsCount++;
                } else {
                    newQuestionsCount++;
                }
            });

            processedQuestions.push(...batchResults);

            const batchDuration = Date.now() - batchStartTime;
            console.log(`✅ [ScrapeData] Question batch ${currentBatch} completed in ${batchDuration}ms`);
            console.log(`📊 [ScrapeData] Progress: ${processedQuestions.length}/${allQuestion.length} questions processed`);
        }

        allQuestion = processedQuestions;

        console.log(`\n📈 [ScrapeData] Processing Summary:`);
        console.log(`   • Total questions: ${allQuestion.length}`);
        console.log(`   • New questions: ${newQuestionsCount}`);
        console.log(`   • Existing questions: ${existingQuestionsCount}`);

        // Sort questions by number: 1-300 for general questions, then state questions (XX-1 to XX-10)
        console.log(`🔢 [ScrapeData] Sorting questions by number...`);
        allQuestion.sort((a, b) => {
            const parseQuestionNumber = (num: string) => {
                // Handle state questions (e.g., "BB-7", "HE-5")
                if (num.includes('-')) {
                    const [stateCode, questionNum] = num.split('-');
                    // Sort state questions after general questions (starting from 1000)
                    // Each state gets 100 slots (1000-1099 for first state, 1100-1199 for second, etc.)
                    const stateIndex = stateCode.charCodeAt(0) * 100 + stateCode.charCodeAt(1);
                    return 10000 + stateIndex + parseInt(questionNum, 10);
                }

                // Handle general questions (numeric strings like "1", "2", "122", etc.)
                return parseInt(num, 10);
            };

            const numA = parseQuestionNumber(a.num);
            const numB = parseQuestionNumber(b.num);
            return numA - numB;
        });

        console.log(`✅ [ScrapeData] Questions sorted successfully`);
        console.log(`🔍 [ScrapeData] First 5 questions: ${allQuestion.slice(0, 5).map(q => q.num).join(', ')}`);
        console.log(`🔍 [ScrapeData] Last 5 questions: ${allQuestion.slice(-5).map(q => q.num).join(', ')}`);

        console.log(`💾 [ScrapeData] Saving data to file...`);
        const dir = './data';
        const filePath = path.join(dir, 'question.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            console.log(`📁 [ScrapeData] Creating directory: ${dir}`);
            fs.mkdirSync(dir);
        }

        // Write the JSON data to a file
        const writeStartTime = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(allQuestion, null, 2), { encoding: 'utf8' });
        const writeSize = fs.statSync(filePath).size;
        const writeDuration = Date.now() - writeStartTime;

        const totalDuration = Date.now() - scriptStartTime;
        console.log(`\n🎉 [ScrapeData] SUCCESS! Data scraping completed`);
        console.log(`   📁 File: ${filePath}`);
        console.log(`   💽 Size: ${(writeSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   ⏱️ Write time: ${writeDuration}ms`);
        console.log(`   🕐 Total time: ${totalDuration}ms (${(totalDuration / 1000 / 60).toFixed(2)} minutes)`);
        console.log(`   ⚡ Average: ${(totalDuration / allQuestion.length).toFixed(2)}ms per question`);

    } catch (error) {
        const totalDuration = Date.now() - scriptStartTime;
        console.error(`\n💥 [ScrapeData] FAILED after ${totalDuration}ms:`, error);
        throw error;
    }
}