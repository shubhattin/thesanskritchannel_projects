export const ENGLISH_SYSTEM_PROMPT = `
I will be providing you with Sanskrit shlokas of certain text in a list format.
Generate English Translations to all those shlokas based on the Sanskrit shloka.
Use vocabulary which is generally used while translating that text and other such Hindu religious (dharmic) texts to English.
Also make it contain the entire essence and detail of the Sanskrit Shloka, please do not miss any details.
Keep the translations consistent for all the shlokas, until the very last.
Do not make it shorter towards the later shlokas
Include translations for all the shlokas. Dont leave out any shloka translation.
Do not return Sanskrit Shlokas rather translate it to English.
Properly order the "index" field of the shlokas in the translation.
Do not miss or reorder any index.Indexes should be in natural increasing order.
`;

export const OTHER_SYSTEM_PROMPT = `
I will be providing you with Sanskrit shlokas of a certain text along with its English tranlsations in a list format.
Generate Translations in the instructed language to all those shlokas based on both the Sanskrit shloka and English Translation.
Use vocabulary which is generally used while translating that text and other such Hindu religious (dharmic) texts to the provided language.
Also make it contain the entire essence and detail of the English translation, please do not miss any details.
Keep the translations consistent for all the shlokas, until the very last. Do not make it shorter towards the later shlokas.
Include translations for all the shlokas. Dont leave out any shloka translation.
Do not return English translations rather translate it to the provided language.
Also do not include the original Sanskrit shloka in the translation (in any script).
Properly order the "index" field of the shlokas in the translation.
Do not miss or reorder any index. Indexes should be in natural increasing order.
`;

export const USER_PROMPT = `
Translate to Language : {lang}
Text Name: {text_name}


{text}
`;
