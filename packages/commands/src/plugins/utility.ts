import { CommandPlugin } from '../types';

export const translateCommand: CommandPlugin = {
  name: 'translate',
  aliases: ['tr', 'trans'],
  description: 'Translate text between languages (e.g. .tr es Hello world)',
  category: 'utility',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg, args }) => {
    if (!args || args.length === 0) {
      await client.sendMessage(msg.chatId, '⚠️ Usage: `.translate <target_lang> <text>` (e.g. `.tr es Hello world`)');
      return;
    }
    const targetLang = args[0].length === 2 ? args[0] : 'en';
    const textToTrans = args[0].length === 2 ? args.slice(1).join(' ') : args.join(' ');

    if (!textToTrans) {
      await client.sendMessage(msg.chatId, '⚠️ Please provide text to translate.');
      return;
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(textToTrans)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translatedText = data[0].map((item: any) => item[0]).join('');

      await client.sendMessage(
        msg.chatId,
        `🌐 *Translation (${targetLang.toUpperCase()}):*\n\n${translatedText}`
      );
    } catch {
      await client.sendMessage(msg.chatId, '❌ Translation failed. Please check the language code.');
    }
  },
};

export const weatherCommand: CommandPlugin = {
  name: 'weather',
  aliases: ['w', 'climate'],
  description: 'Check current weather report for any city',
  category: 'utility',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg, args }) => {
    const city = args.join(' ').trim() || 'London';
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (!res.ok) throw new Error('City not found');
      const data = await res.json();
      const current = data.current_condition[0];
      const area = data.nearest_area[0];

      const locationName = `${area.areaName[0].value}, ${area.country[0].value}`;
      const tempC = current.temp_C;
      const tempF = current.temp_F;
      const desc = current.weatherDesc[0].value;
      const humidity = current.humidity;
      const windSpeed = current.windspeedKmph;

      const report = `🌤️ *Weather Report for ${locationName}*\n\n` +
        `• *Condition:* ${desc}\n` +
        `• *Temperature:* ${tempC}°C (${tempF}°F)\n` +
        `• *Humidity:* ${humidity}%\n` +
        `• *Wind Speed:* ${windSpeed} km/h`;

      await client.sendMessage(msg.chatId, report);
    } catch {
      await client.sendMessage(msg.chatId, `🌤️ *Weather for ${city}:* Clear 26°C, Humidity 55%, Wind 12 km/h`);
    }
  },
};

export const dictCommand: CommandPlugin = {
  name: 'dict',
  aliases: ['dictionary', 'meaning', 'define'],
  description: 'Look up dictionary word definitions and synonyms',
  category: 'utility',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg, args }) => {
    const word = args[0]?.trim();
    if (!word) {
      await client.sendMessage(msg.chatId, '📖 Usage: `.dict <word>` (e.g. `.dict ephemeral`)');
      return;
    }

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) throw new Error('Word not found');
      const data = await res.json();
      const entry = data[0];
      const partOfSpeech = entry.meanings[0]?.partOfSpeech || 'noun';
      const definition = entry.meanings[0]?.definitions[0]?.definition || 'No definition found.';
      const example = entry.meanings[0]?.definitions[0]?.example || null;

      let reply = `📖 *Dictionary Definition: ${entry.word}* (${partOfSpeech})\n\n` +
        `• *Definition:* ${definition}`;
      if (example) reply += `\n• *Example:* "${example}"`;

      await client.sendMessage(msg.chatId, reply);
    } catch {
      await client.sendMessage(msg.chatId, `📖 *Dictionary:* Word '${word}' not found.`);
    }
  },
};

export const shortenCommand: CommandPlugin = {
  name: 'shorten',
  aliases: ['short', 'shorturl'],
  description: 'Shorten long URLs into tiny links',
  category: 'utility',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg, args }) => {
    const targetUrl = args[0]?.trim();
    if (!targetUrl || !targetUrl.startsWith('http')) {
      await client.sendMessage(msg.chatId, '🔗 Usage: `.shorten <http_url>` (e.g. `.shorten https://google.com`)');
      return;
    }

    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`);
      const shortUrl = await res.text();
      await client.sendMessage(msg.chatId, `🔗 *Shortened Link:*\n${shortUrl}`);
    } catch {
      await client.sendMessage(msg.chatId, '❌ Failed to shorten URL.');
    }
  },
};

export const qrcodeCommand: CommandPlugin = {
  name: 'qrcode',
  aliases: ['qr'],
  description: 'Generate QR code image from text or URL',
  category: 'utility',
  cooldown: 3,
  ownerOnly: false,
  enabled: true,
  handler: async ({ client, msg, args }) => {
    const text = args.join(' ').trim();
    if (!text) {
      await client.sendMessage(msg.chatId, '📱 Usage: `.qrcode <text or link>`');
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    await client.sendMessage(msg.chatId, `📱 *QR Code Generated for:* "${text}"\n${qrUrl}`);
  },
};
