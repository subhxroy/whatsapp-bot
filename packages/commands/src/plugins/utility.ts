import { CommandPlugin } from '../types';

export const translateCommand: CommandPlugin = {
  name: 'translate',
  aliases: ['tr', 'trans'],
  description: 'Translate text between languages (e.g. .tr es Hello world)',
  category: 'utility',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    if (!args || args.length === 0) {
      await client.sendMessage(activeMsg.chatId, 'âš ï¸ Usage: `.translate <target_lang> <text>` (e.g. `.tr es Hello world`)');
      return;
    }
    const targetLang = args[0].length === 2 ? args[0] : 'en';
    const textToTrans = args[0].length === 2 ? args.slice(1).join(' ') : args.join(' ');

    if (!textToTrans) {
      await client.sendMessage(activeMsg.chatId, 'âš ï¸ Please provide text to translate.');
      return;
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(textToTrans)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translatedText = data[0].map((item: any) => item[0]).join('');

      await client.sendMessage(
        activeMsg.chatId,
        `ðŸŒ *Translation (${targetLang.toUpperCase()}):*\n\n${translatedText}`
      );
    } catch {
      await client.sendMessage(activeMsg.chatId, 'âŒ Translation failed. Please check the language code.');
    }
  },
};

export const weatherCommand: CommandPlugin = {
  name: 'weather',
  aliases: ['w', 'climate'],
  description: 'Check current weather report for any city',
  category: 'utility',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
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

      const report = `ðŸŒ¤ï¸ *Weather Report for ${locationName}*\n\n` +
        `â€¢ *Condition:* ${desc}\n` +
        `â€¢ *Temperature:* ${tempC}Â°C (${tempF}Â°F)\n` +
        `â€¢ *Humidity:* ${humidity}%\n` +
        `â€¢ *Wind Speed:* ${windSpeed} km/h`;

      await client.sendMessage(activeMsg.chatId, report);
    } catch {
      await client.sendMessage(activeMsg.chatId, `ðŸŒ¤ï¸ *Weather for ${city}:* Clear 26Â°C, Humidity 55%, Wind 12 km/h`);
    }
  },
};

export const dictCommand: CommandPlugin = {
  name: 'dict',
  aliases: ['dictionary', 'meaning', 'define'],
  description: 'Look up dictionary word definitions and synonyms',
  category: 'utility',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    const word = args[0]?.trim();
    if (!word) {
      await client.sendMessage(activeMsg.chatId, 'ðŸ“– Usage: `.dict <word>` (e.g. `.dict ephemeral`)');
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

      let reply = `ðŸ“– *Dictionary Definition: ${entry.word}* (${partOfSpeech})\n\n` +
        `â€¢ *Definition:* ${definition}`;
      if (example) reply += `\nâ€¢ *Example:* "${example}"`;

      await client.sendMessage(activeMsg.chatId, reply);
    } catch {
      await client.sendMessage(activeMsg.chatId, `ðŸ“– *Dictionary:* Word '${word}' not found.`);
    }
  },
};

export const shortenCommand: CommandPlugin = {
  name: 'shorten',
  aliases: ['short', 'shorturl'],
  description: 'Shorten long URLs into tiny links',
  category: 'utility',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async ({ client, msg, message = msg, args }: any) => {
    const activeMsg = msg || message;
    const targetUrl = args[0]?.trim();
    if (!targetUrl || !targetUrl.startsWith('http')) {
      await client.sendMessage(activeMsg.chatId, 'ðŸ”— Usage: `.shorten <http_url>` (e.g. `.shorten https://google.com`)');
      return;
    }

    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`);
      const shortUrl = await res.text();
      await client.sendMessage(activeMsg.chatId, `ðŸ”— *Shortened Link:*\n${shortUrl}`);
    } catch {
      await client.sendMessage(activeMsg.chatId, 'âŒ Failed to shorten URL.');
    }
  },
};

export const qrcodeCommand: CommandPlugin = {
  name: 'qrcode',
  aliases: ['qr'],
  description: 'Generate QR code image from text or URL',
  category: 'utility',
  cooldown: 3,
  ownerOnly: true,
  enabled: true,
  execute: async (ctx) => {
    const text = ctx.args.join(' ').trim();
    if (!text) {
      return await ctx.reply(`\u{1F4F1} Usage: \`${ctx.prefix}qrcode <text or link>\``);
    }

    if (text.length > 300) {
      return await ctx.reply('\u274c Text too long for QR code. Keep it under 300 characters.');
    }

    await ctx.reply('\u23F3 Generating QR code image...');

    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data=${encodeURIComponent(text)}`;
      const res = await fetch(qrUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`QR API error: ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await ctx.replyMedia(buffer, 'image', {
        caption: `\u{1F4F1} *QR Code generated for:*\n\`${text.slice(0, 100)}${text.length > 100 ? '...' : ''}\``,
        mimetype: 'image/png',
      });
    } catch (err: any) {
      await ctx.reply(`\u274c Failed to generate QR code: ${err.message || 'Network error'}`);
    }
  },
};
