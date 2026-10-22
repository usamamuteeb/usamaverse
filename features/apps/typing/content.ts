import { defaultConfig, graphemes, type TypingConfig } from './engine';

// Independently assembled everyday English practice words; no imported typing corpus.
const words = `about above across action again air allow almost along already also always among answer around art ask away back balance base basic beach become before begin behind better between beyond blue book bright bring build calm care carry change choose city clean clear close cloud color come common connect create daily dance dark day decide deep design detail different door dream drive early earth easy edge effort enjoy enough even ever every example explore face family far fast feel field find first focus follow form forward fresh friend from future game garden give glass goal good great green group grow guide hand happy hard head heart help here high history home hope house idea imagine improve inside instead interest into island keep key kind know large later learn leave left light like line little local long look love main make many matter maybe morning move music name near need never new night notice number ocean open order other page paint paper part path pattern people place plan play point practice present pretty process project quiet reach read ready real reason remember result right river road room round run safe same save school search see sense shape share short show side simple skill small smile smooth sound space spark start state still story strong study style sunny support sure system take talk task teach team test text think time today together tool touch track travel try turn useful user value view voice wait walk warm water way welcome well white whole wide window wish word work world write young`.split(' ');

// Original passages written for this app.
export const quotes = {
  short: [
    'A small steady practice can change the shape of a day.',
    'The clearest idea often arrives after a quiet pause.',
    'Good work grows one careful step at a time.',
  ],
  medium: [
    'When a task feels too large, begin with the next visible step. The page becomes easier to read once the first line is written.',
    'A useful habit is simple enough to repeat on an ordinary day. Give it a little attention, then let the results gather over time.',
    'The room was quiet, but the window held a thousand moving details. She noticed the rain, the street, and the changing light.',
  ],
  long: [
    'There is no need to rush through every beginning. Place your hands on the keys, find a comfortable rhythm, and let each word take its proper space. If a mistake appears, notice it and continue with care. Progress is easier to see when you give yourself enough time to practice.',
    'The first map was drawn on a folded sheet of paper. It marked the river, the old bridge, and the path through the trees. By morning, the travelers knew that the map could not show every turn. They would have to watch the road, ask good questions, and make a few discoveries of their own.',
  ],
} as const;

export function validateConfig(value: TypingConfig): string | null {
  if (value.mode === 'time' && (!Number.isInteger(value.seconds) || value.seconds < 5 || value.seconds > 300)) return 'Choose a time from 5 to 300 seconds.';
  if (value.mode === 'words' && (!Number.isInteger(value.wordCount) || value.wordCount < 5 || value.wordCount > 500)) return 'Choose a word count from 5 to 500.';
  if (value.mode === 'custom' && (graphemes(value.customText.trim()).length < 2 || graphemes(value.customText).length > 5000)) return 'Enter 2 to 5,000 characters of custom text.';
  return null;
}

function random(seed: number): () => number {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function buildPrompt(config: TypingConfig, seed: number): string {
  if (config.mode === 'custom') return config.customText.trim();
  const next = random(seed);
  if (config.mode === 'quote') {
    const list = quotes[config.quoteLength] ?? quotes.short;
    return list[Math.floor(next() * list.length)];
  }
  const count = config.mode === 'time' ? 800 : config.wordCount;
  const output: string[] = [];
  let previous = '';
  for (let index = 0; index < count; index += 1) {
    let word = words[Math.floor(next() * words.length)];
    if (word === previous) word = words[(words.indexOf(word) + 1 + Math.floor(next() * (words.length - 1))) % words.length];
    previous = word;
    if (config.numbers && index > 0 && index % 13 === 0) word = String(10 + Math.floor(next() * 990));
    if (config.punctuation) {
      if (index === 0 || index % 14 === 0) word = word[0].toUpperCase() + word.slice(1);
      if ((index + 1) % 14 === 0 || index === count - 1) word += '.';
      else if ((index + 1) % 7 === 0) word += ',';
    }
    output.push(word);
  }
  return output.join(' ');
}

export function safeConfig(value: unknown): TypingConfig {
  if (!value || typeof value !== 'object') return { ...defaultConfig };
  const source = value as Partial<TypingConfig>;
  const result: TypingConfig = {
    ...defaultConfig,
    mode: ['time', 'words', 'quote', 'custom'].includes(String(source.mode)) ? source.mode! : defaultConfig.mode,
    seconds: Number.isInteger(source.seconds) && source.seconds! >= 5 && source.seconds! <= 300 ? source.seconds! : defaultConfig.seconds,
    wordCount: Number.isInteger(source.wordCount) && source.wordCount! >= 5 && source.wordCount! <= 500 ? source.wordCount! : defaultConfig.wordCount,
    quoteLength: ['short', 'medium', 'long'].includes(String(source.quoteLength)) ? source.quoteLength! : defaultConfig.quoteLength,
    customText: '',
    punctuation: source.punctuation === true,
    numbers: source.numbers === true,
    language: 'en',
  };
  return result;
}
