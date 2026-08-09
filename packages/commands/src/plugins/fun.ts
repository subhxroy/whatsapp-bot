import { CommandPlugin } from '../types';

export const rollCommand: CommandPlugin = {
  name: 'roll',
  aliases: ['dice'],
  description: 'Roll a random dice (1-6) or custom dice (e.g. .roll d20)',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    let max = 6;
    if (args[0] && args[0].toLowerCase().startsWith('d')) {
      max = parseInt(args[0].slice(1), 10) || 6;
    } else if (args[0]) {
      max = parseInt(args[0], 10) || 6;
    }
    const result = Math.floor(Math.random() * max) + 1;
    await client.sendMessage(activeMsg.chatId, `🎲 *Dice Roll (1-${max}):* You rolled a *${result}*!`);
  },
};

export const flipCommand: CommandPlugin = {
  name: 'flip',
  aliases: ['coin', 'coinflip'],
  description: 'Flip a coin (Heads or Tails)',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const outcome = Math.random() < 0.5 ? 'HEADS 🪙' : 'TAILS 🪙';
    await client.sendMessage(activeMsg.chatId, `🪙 *Coin Flip:* Result is *${outcome}*!`);
  },
};

export const quoteCommand: CommandPlugin = {
  name: 'quote',
  aliases: ['motivate'],
  description: 'Get an inspiring random quote',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const quotes = [
      { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
      { q: "It always seems impossible until it's done.", a: "Nelson Mandela" },
      { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
      { q: "Quality is not an act, it is a habit.", a: "Aristotle" },
      { q: "Action is the foundational key to all success.", a: "Pablo Picasso" }
    ];
    const item = quotes[Math.floor(Math.random() * quotes.length)];
    await client.sendMessage(activeMsg.chatId, `💬 "${item.q}"\n\n— *${item.a}*`);
  },
};

export const jokeCommand: CommandPlugin = {
  name: 'joke',
  aliases: ['pun'],
  description: 'Get a funny joke',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything!",
      "Why did the developer quit his job? Because he didn't get arrays!",
      "There are 10 types of people in the world: those who understand binary, and those who don't.",
      "Why do Java developers wear glasses? Because they don't C#!",
      "What is a programmer's favorite place to hang out? Foo Bar!"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await client.sendMessage(activeMsg.chatId, `😂 *Joke of the day:*\n\n${joke}`);
  },
};

export const triviaCommand: CommandPlugin = {
  name: 'trivia',
  aliases: ['quiz'],
  description: 'Get a random trivia question with answer',
  category: 'fun',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const triviaList = [
      { q: "What is the capital city of Japan?", a: "Tokyo" },
      { q: "Which planet is known as the Red Planet?", a: "Mars" },
      { q: "What is the chemical symbol for Gold?", a: "Au" },
      { q: "Who wrote 'Romeo and Juliet'?", a: "William Shakespeare" },
      { q: "What is the largest ocean on Earth?", a: "Pacific Ocean" }
    ];
    const t = triviaList[Math.floor(Math.random() * triviaList.length)];
    await client.sendMessage(activeMsg.chatId, `🧠 *Trivia Question:*\n\n${t.q}\n\n*Answer:* ||${t.a}||`);
  },
};

export const factCommand: CommandPlugin = {
  name: 'fact',
  aliases: ['funfact'],
  description: 'Get an interesting random fun fact',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg }: any) => {
    const activeMsg = msg || message;
    const facts = [
      "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that is still edible!",
      "Bananas are curved because they grow towards the sun against gravity.",
      "Octopuses have three hearts and blue blood.",
      "A day on Venus is longer than a year on Venus.",
      "Wombat poop is cube-shaped to stop it from rolling away!"
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    await client.sendMessage(activeMsg.chatId, `💡 *Fun Fact:*\n\n${fact}`);
  },
};

export const eightBallCommand: CommandPlugin = {
  name: '8ball',
  aliases: ['eightball'],
  description: 'Ask the Magic 8-Ball any question',
  category: 'fun',
  cooldown: 2,
  ownerOnly: false,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    if (!args || args.length === 0) {
      await client.sendMessage(activeMsg.chatId, '🎱 Usage: `.8ball <question>` (e.g. `.8ball Will today be a great day?`)');
      return;
    }

    const responses = [
      "It is certain.",
      "Without a doubt.",
      "Yes - definitely.",
      "Most likely.",
      "Outlook good.",
      "Reply hazy, try again.",
      "Ask again later.",
      "Don't count on it.",
      "My reply is no.",
      "Very doubtful."
    ];

    const ans = responses[Math.floor(Math.random() * responses.length)];
    await client.sendMessage(activeMsg.chatId, `🎱 *Magic 8-Ball says:* "${ans}"`);
  },
};
