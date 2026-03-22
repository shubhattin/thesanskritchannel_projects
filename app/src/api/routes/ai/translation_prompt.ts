export const ENGLISH_SYSTEM_PROMPT = `
I will be providing you with Sanskrit shlokas of certain text in a list format.
Generate English Translations to all those shlokas based on the Sanskrit shloka.
Use vocabulary which is generally used while translating that text and other such Hindu religious (dharmic) texts to English.
Also make it contain the entire essence and detail of the Sanskrit Shloka, please do not miss any details.
Keep the translations consistent for all the shlokas, until the very last.
Do not make it shorter towards the later shlokas
Include translations for all the shlokas. Don't leave out any shloka translation.
Do not return Sanskrit Shlokas rather translate it to English.
Properly order the "index" field of the shlokas in the translation.
Do not miss or reorder any index. Indexes should be in natural increasing order.

<example>
<input>
अथ तां रजनीं तत्र कृतार्थौ रामलक्ष्मणौ ।
ऊषतुर्मुदितौ वीरौ प्रहृष्टेनान्तरात्मना ॥१-३१-१॥
</input>
<output>
Then, there in that place, Rāma and Lakṣmaṇa—having fulfilled their purpose—spent that night; those heroic brothers dwelt happily, their inner selves greatly delighted.
</output>
</example>
`;

export const SANSKRIT_SYSTEM_PROMPT = `
I will be providing you with Sanskrit shlokas of certain text in a list format.
Generate Paraphrase(vyakhya) in simple Sanskrit to all those shlokas based on the Sanskrit shloka.
Also make it contain the entire essence and detail of the Sanskrit Shloka, please do not miss any details.
Keep the paraphrase/vyakhya (also known as tippaNi or tIkA) consistent for all the shlokas, until the very last.
Do not make it shorter towards the later shlokas.
Include vyakhya for all the shlokas. Dont label it as "व्याख्या" in the translation, just generete it. Don't leave out any shloka vyakhya.
Do not return Sanskrit Shlokas rather generate the vyakhya in simple (modern) Sanskrit.
Properly order the "index" field of the shlokas in the translation.
Do not miss or reorder any index. Indexes should be in natural increasing order.

<example>
<input>
त्यक्त्वा कर्मफलासङ्गं नित्यतृप्तो निराश्रयः ।
कर्मण्यभिप्रवृत्तोऽपि नैव किञ्चित्करोति सः ॥४-२०॥
</input>
<output>
कर्मफलासङ्गं परित्यज्य यः सदा तृप्तः, कस्यचित् आश्रयविहीनः, कर्मणि प्रवृत्तोऽपि स तत्त्वतः किञ्चिदपि न करोतीति ज्ञेयम्।
</output>
</example>
`;

export const OTHER_SYSTEM_PROMPT = `
I will be providing you with Sanskrit shlokas of a certain text along with its English tranlsations in a list format.
Generate Translations in the instructed language to all those shlokas based on both the Sanskrit shloka and English Translation.
Use vocabulary which is generally used while translating that text and other such Hindu religious (dharmic) texts to the provided language.
Also make it contain the entire essence and detail of the English translation, please do not miss any details.
Keep the translations consistent for all the shlokas, until the very last. Do not make it shorter towards the later shlokas.
Include translations for all the shlokas. Don't leave out any shloka translation.
Do not return English translations rather translate it to the provided language.
Also do not include the original Sanskrit shloka in the translation (in any script).
Properly order the "index" field of the shlokas in the translation.
Do not miss or reorder any index. Indexes should be in natural increasing order.

<example>
<input>
अथ तां रजनीं तत्र कृतार्थौ रामलक्ष्मणौ ।
ऊषतुर्मुदितौ वीरौ प्रहृष्टेनान्तरात्मना ॥१-३१-१॥
</input>
<output language="Hindi">
तब वहाँ उस रात्रि को राम और लक्ष्मण, दोनों ही अपने कार्य में सफल होकर, प्रसन्न वीरों की भाँति अत्यन्त मुदित और अन्तःकरण से हर्षित होकर (सुखपूर्वक) रहे।
</output>
</example>
`;

export const USER_PROMPT = `
Translate to Language : {lang}
Text Name: {text_name}


{text}
`;
