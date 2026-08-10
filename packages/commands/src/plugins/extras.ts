import { CommandPlugin } from '../types';

/**
 * .time â€” World clock: get current time for any city or timezone.
 * Uses the worldtimeapi.org or IP-based time lookup as fallback.
 */
export const timeCommand: CommandPlugin = {
  name: 'time',
  aliases: ['clock', 'timezone', 'tz'],
  description: 'Get current time for any city or timezone (e.g. .time India)',
  category: 'utility',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const query = ctx.args.join(' ').trim();
    if (!query) {
      return await ctx.reply(
        `\u{1F550} *WORLD CLOCK*\n\n` +
        `*Usage:* \`${ctx.prefix}time <city or timezone>\`\n` +
        `*Examples:*\n` +
        `\u2022 \`${ctx.prefix}time India\`\n` +
        `\u2022 \`${ctx.prefix}time New York\`\n` +
        `\u2022 \`${ctx.prefix}time UTC\``
      );
    }

    try {
      // Map common city names to IANA timezone identifiers
      const cityMap: Record<string, string> = {
        india: 'Asia/Kolkata', kolkata: 'Asia/Kolkata', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata',
        london: 'Europe/London', uk: 'Europe/London',
        'new york': 'America/New_York', nyc: 'America/New_York', 'new_york': 'America/New_York',
        'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles',
        tokyo: 'Asia/Tokyo', japan: 'Asia/Tokyo',
        dubai: 'Asia/Dubai', uae: 'Asia/Dubai',
        paris: 'Europe/Paris', france: 'Europe/Paris',
        berlin: 'Europe/Berlin', germany: 'Europe/Berlin',
        sydney: 'Australia/Sydney', australia: 'Australia/Sydney',
        singapore: 'Asia/Singapore',
        beijing: 'Asia/Shanghai', china: 'Asia/Shanghai',
        utc: 'UTC', gmt: 'UTC',
        moscow: 'Europe/Moscow', russia: 'Europe/Moscow',
        istanbul: 'Europe/Istanbul', turkey: 'Europe/Istanbul',
        cairo: 'Africa/Cairo', egypt: 'Africa/Cairo',
        toronto: 'America/Toronto', canada: 'America/Toronto',
        'sao paulo': 'America/Sao_Paulo', brazil: 'America/Sao_Paulo',
        lagos: 'Africa/Lagos', nigeria: 'Africa/Lagos',
        nairobi: 'Africa/Nairobi', kenya: 'Africa/Nairobi',
        bangkok: 'Asia/Bangkok', thailand: 'Asia/Bangkok',
        jakarta: 'Asia/Jakarta', indonesia: 'Asia/Jakarta',
        karachi: 'Asia/Karachi', pakistan: 'Asia/Karachi',
        dhaka: 'Asia/Dhaka', bangladesh: 'Asia/Dhaka',
        kathmandu: 'Asia/Kathmandu', nepal: 'Asia/Kathmandu',
        colombo: 'Asia/Colombo', srilanka: 'Asia/Colombo', 'sri lanka': 'Asia/Colombo',
        yangon: 'Asia/Yangon', myanmar: 'Asia/Yangon',
      };

      const key = query.toLowerCase();
      let timezone = cityMap[key];

      if (!timezone) {
        // Try worldtimeapi with timezone search
        const searchRes = await fetch(`https://worldtimeapi.org/api/timezone`);
        const allZones: string[] = await searchRes.json();
        const match = allZones.find((z) => z.toLowerCase().includes(key.replace(' ', '_')) || z.toLowerCase().includes(key));
        timezone = match || 'UTC';
      }

      const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`);
      if (!res.ok) throw new Error('Timezone not found');
      const data = await res.json();
      const dt = new Date(data.datetime);
      const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const dateStr = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      await ctx.reply(
        `\u{1F550} *World Clock â€” ${query.toUpperCase()}*\n\n` +
        `\u2022 *Time:* ${timeStr}\n` +
        `\u2022 *Date:* ${dateStr}\n` +
        `\u2022 *Timezone:* ${data.timezone}\n` +
        `\u2022 *UTC Offset:* ${data.utc_offset}`
      );
    } catch {
      // Fallback: use JS Intl
      try {
        const zones: Record<string, string> = { india: 'Asia/Kolkata', utc: 'UTC', london: 'Europe/London' };
        const tz = zones[query.toLowerCase()] || 'UTC';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: true, hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        await ctx.reply(`\u{1F550} *Time in ${query}:* ${timeStr}, ${dateStr}`);
      } catch {
        await ctx.reply('\u274c Could not determine time for that location. Try a timezone like `Asia/Kolkata` or `UTC`.');
      }
    }
  },
};

/**
 * .currency â€” Live forex currency converter using exchangerate-api (free tier).
 */
export const currencyCommand: CommandPlugin = {
  name: 'currency',
  aliases: ['convert', 'forex', 'fx'],
  description: 'Convert between currencies with live exchange rates (e.g. .currency 100 USD INR)',
  category: 'utility',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    // Usage: .currency <amount> <FROM> <TO>
    if (ctx.args.length < 3) {
      return await ctx.reply(
        `\u{1F4B1} *CURRENCY CONVERTER*\n\n` +
        `*Usage:* \`${ctx.prefix}currency <amount> <FROM> <TO>\`\n` +
        `*Examples:*\n` +
        `\u2022 \`${ctx.prefix}currency 100 USD INR\`\n` +
        `\u2022 \`${ctx.prefix}currency 50 EUR GBP\`\n` +
        `\u2022 \`${ctx.prefix}currency 1000 INR USD\``
      );
    }

    const amount = parseFloat(ctx.args[0]);
    const fromCurr = ctx.args[1].toUpperCase();
    const toCurr = ctx.args[2].toUpperCase();

    if (isNaN(amount) || amount <= 0) {
      return await ctx.reply('\u274c Please provide a valid positive amount.');
    }

    try {
      // Free no-key API: exchangerate-api open
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(fromCurr)}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      if (data.result !== 'success') throw new Error('Currency not found');
      const rate = data.rates?.[toCurr];
      if (!rate) throw new Error(`Currency code ${toCurr} not found`);

      const converted = (amount * rate).toFixed(2);
      const rateDisplay = rate.toFixed(6);

      await ctx.reply(
        `\u{1F4B1} *Currency Conversion*\n\n` +
        `\u2022 *Amount:* ${amount.toLocaleString()} ${fromCurr}\n` +
        `\u2022 *Result:* ${parseFloat(converted).toLocaleString()} ${toCurr}\n` +
        `\u2022 *Rate:* 1 ${fromCurr} = ${rateDisplay} ${toCurr}\n` +
        `\u2022 *Source:* Open Exchange Rates (live)`
      );
    } catch (err: any) {
      await ctx.reply(`\u274c Currency conversion failed: ${err.message || 'Invalid currency code or network error'}`);
    }
  },
};

/**
 * .remind â€” Personal timer that sends you a reminder message after a delay.
 */
export const remindCommand: CommandPlugin = {
  name: 'remind',
  aliases: ['reminder', 'remindme'],
  description: 'Set a personal reminder. Usage: .remind 10m Buy groceries',
  category: 'utility',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    if (ctx.args.length < 2) {
      return await ctx.reply(
        `\u23f0 *REMINDER TOOL*\n\n` +
        `*Usage:* \`${ctx.prefix}remind <time> <message>\`\n\n` +
        `*Time formats:*\n` +
        `\u2022 \`30s\` â€” 30 seconds\n` +
        `\u2022 \`5m\` â€” 5 minutes\n` +
        `\u2022 \`2h\` â€” 2 hours\n\n` +
        `*Examples:*\n` +
        `\u2022 \`${ctx.prefix}remind 10m Take medicine\`\n` +
        `\u2022 \`${ctx.prefix}remind 1h Meeting starts now!\`\n` +
        `\u2022 \`${ctx.prefix}remind 30s Check the oven`
      );
    }

    const timeStr = ctx.args[0].toLowerCase();
    const reminderText = ctx.args.slice(1).join(' ');

    // Parse time: 30s, 5m, 2h
    let ms = 0;
    const match = timeStr.match(/^(\d+)(s|m|h)$/);
    if (!match) {
      return await ctx.reply('\u274c Invalid time format. Use `30s`, `5m`, or `2h`.');
    }
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 's') ms = value * 1000;
    else if (unit === 'm') ms = value * 60 * 1000;
    else if (unit === 'h') ms = value * 60 * 60 * 1000;

    const MAX_MS = 6 * 60 * 60 * 1000; // 6 hours max
    if (ms > MAX_MS) {
      return await ctx.reply('\u274c Maximum reminder time is 6 hours. Use the `.birthday` command for longer scheduled messages.');
    }
    if (ms < 5000) {
      return await ctx.reply('\u274c Minimum reminder time is 5 seconds.');
    }

    const friendlyTime = unit === 's' ? `${value} second${value !== 1 ? 's' : ''}` :
      unit === 'm' ? `${value} minute${value !== 1 ? 's' : ''}` :
        `${value} hour${value !== 1 ? 's' : ''}`;

    await ctx.reply(`\u23f0 Reminder set! I'll remind you in *${friendlyTime}*.\n\n_Message: "${reminderText}"_`);

    const chatId = ctx.message.chatId;
    const senderName = ctx.message.pushName || ctx.message.senderNumber;

    setTimeout(async () => {
      try {
        await ctx.client.sendMessage(chatId, `\u{1F514} *REMINDER for ${senderName}:*\n\n${reminderText}\n\n_This reminder was set ${friendlyTime} ago._`);
      } catch {
        // Client may have disconnected â€” reminder silently dropped
      }
    }, ms);
  },
};

/**
 * .emoji â€” Convert text to emoji art using letter emojis.
 */
export const emojiCommand: CommandPlugin = {
  name: 'emoji',
  aliases: ['emojify', 'letteremoji'],
  description: 'Convert text to emoji block art letters',
  category: 'fun',
  ownerOnly: true,
  enabled: true,
  cooldown: 3,
  execute: async (ctx) => {
    const text = ctx.args.join(' ').trim().toUpperCase();
    if (!text) {
      return await ctx.reply(`\u{1F192} Usage: \`${ctx.prefix}emoji <text>\` (e.g. \`${ctx.prefix}emoji HELLO\`)`);
    }
    if (text.length > 30) {
      return await ctx.reply('\u274c Text too long! Max 30 characters for emoji art.');
    }

    const letterMap: Record<string, string> = {
      A: '\u{1F1E6}', B: '\u{1F1E7}', C: '\u{1F1E8}', D: '\u{1F1E9}', E: '\u{1F1EA}',
      F: '\u{1F1EB}', G: '\u{1F1EC}', H: '\u{1F1ED}', I: '\u{1F1EE}', J: '\u{1F1EF}',
      K: '\u{1F1F0}', L: '\u{1F1F1}', M: '\u{1F1F2}', N: '\u{1F1F3}', O: '\u{1F1F4}',
      P: '\u{1F1F5}', Q: '\u{1F1F6}', R: '\u{1F1F7}', S: '\u{1F1F8}', T: '\u{1F1F9}',
      U: '\u{1F1FA}', V: '\u{1F1FB}', W: '\u{1F1FC}', X: '\u{1F1FD}', Y: '\u{1F1FE}', Z: '\u{1F1FF}',
      '0': '0\uFE0F\u20E3', '1': '1\uFE0F\u20E3', '2': '2\uFE0F\u20E3', '3': '3\uFE0F\u20E3',
      '4': '4\uFE0F\u20E3', '5': '5\uFE0F\u20E3', '6': '6\uFE0F\u20E3', '7': '7\uFE0F\u20E3',
      '8': '8\uFE0F\u20E3', '9': '9\uFE0F\u20E3',
      ' ': '  ', '!': '\u2757', '?': '\u2753', '+': '\u2795', '-': '\u2796',
      '#': '\u0023\uFE0F\u20E3', '*': '\u002A\uFE0F\u20E3',
    };

    const result = text.split('').map((c) => letterMap[c] || c).join('');
    await ctx.reply(`\u{1F192} *Emoji Art:*\n\n${result}`);
  },
};

/**
 * .roast â€” Friendly AI-powered roast of a mentioned user.
 */
export const roastCommand: CommandPlugin = {
  name: 'roast',
  aliases: ['burn', 'rekt'],
  description: 'Get a fun roast message (friendly humor, not offensive)',
  category: 'fun',
  ownerOnly: true,
  enabled: true,
  cooldown: 5,
  execute: async (ctx) => {
    const target = ctx.args.join(' ').trim() || 'this person';
    const roasts = [
      `${target}, you're the reason they put instructions on shampoo bottles.`,
      `${target}, if brains were dynamite, you couldn't blow your hat off.`,
      `${target}, I'd roast you harder, but my mom said I'm not allowed to burn trash.`,
      `${target}, you're not stupid â€” you just have bad luck thinking.`,
      `${target}, someday you'll go farâ€¦ and I hope you stay there.`,
      `${target}, I'd call you a tool but that implies you're actually useful.`,
      `${target}, you're living proof that even nature makes mistakes.`,
      `${target}, if laughter is the best medicine, your face must be curing diseases.`,
      `${target}, you have your entire life to be stupid â€” why not take a day off?`,
      `${target}, even your WiFi connection has more personality than you.`,
      `${target}, you're the human equivalent of a participation award.`,
      `${target}, I've seen better looking things come out of a loot box on the last spin.`,
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    await ctx.reply(`\u{1F525} *ROASTED:*\n\n_"${roast}"_\n\n_â€” Caldera Bot, with love \u2764\uFE0F_`);
  },
};

/**
 * .summarize â€” AI-powered TLDR summary of long text.
 */
export const summarizeCommand: CommandPlugin = {
  name: 'summarize',
  aliases: ['tldr', 'sum', 'brief'],
  description: 'Summarize long text using AI (only if AI_ENABLED=true)',
  category: 'ai',
  ownerOnly: true,
  enabled: true,
  cooldown: 8,
  execute: async (ctx) => {
    const { getEnv } = await import('@private-md-bot/config');
    const { getAIProvider } = await import('@private-md-bot/ai');
    const env = getEnv();

    if (!env.AI_ENABLED) {
      return await ctx.reply('\u{1F512} AI features are disabled. Enable AI in bot settings to use `.summarize`.');
    }

    // Support both: inline text OR quoted reply text
    let text = ctx.args.join(' ').trim();
    if (!text) {
      // Try to get quoted message text
      const quoted = ctx.message.rawMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      text = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    }

    if (!text || text.length < 50) {
      return await ctx.reply(
        `\u{1F4DD} *AI SUMMARIZER*\n\n` +
        `*Usage:*\n` +
        `\u2022 Type text after the command: \`${ctx.prefix}summarize <long text>\`\n` +
        `\u2022 Or reply to a long message with: \`${ctx.prefix}summarize\`\n\n` +
        `_Minimum 50 characters required._`
      );
    }

    if (text.length > 8000) {
      return await ctx.reply('\u274c Text too long! Please keep it under 8000 characters.');
    }

    await ctx.reply('\u{1F914} Summarizing...');

    try {
      const provider = getAIProvider('gemini');
      const response = await provider.generateText(
        `Please provide a clear, concise summary (bullet points preferred) of the following text. Keep it under 150 words:\n\n${text}`,
        { systemPrompt: 'You are a professional summarizer. Extract the key points clearly and concisely.' }
      );
      await ctx.reply(`\u{1F4CB} *AI Summary:*\n\n${response.text}`);
    } catch (err: any) {
      await ctx.reply(`\u274c Summarization failed: ${err.message || 'AI provider error'}`);
    }
  },
};

/**
 * .imagine â€” AI image generation from text prompt.
 * Uses pollinations.ai (free, no API key needed) as primary.
 */
export const imagineCommand: CommandPlugin = {
  name: 'imagine',
  aliases: ['image', 'generate', 'img', 'draw'],
  description: 'Generate an AI image from a text prompt (e.g. .imagine sunset over mountains)',
  category: 'ai',
  ownerOnly: true,
  enabled: true,
  cooldown: 15,
  execute: async (ctx) => {
    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
      return await ctx.reply(
        `\u{1F3A8} *AI IMAGE GENERATOR*\n\n` +
        `*Usage:* \`${ctx.prefix}imagine <description>\`\n\n` +
        `*Examples:*\n` +
        `\u2022 \`${ctx.prefix}imagine a futuristic city at night with neon lights\`\n` +
        `\u2022 \`${ctx.prefix}imagine cute cat wearing a wizard hat\`\n` +
        `\u2022 \`${ctx.prefix}imagine sunset over the Himalayas, photorealistic\``
      );
    }

    if (prompt.length > 500) {
      return await ctx.reply('\u274c Prompt too long! Keep it under 500 characters.');
    }

    await ctx.reply(`\u{1F3A8} Generating image for: _"${prompt}"_\n_This may take 10-20 seconds..._`);

    try {
      // pollinations.ai: free, no key required, returns direct image
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

      // Fetch the image as buffer
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`Image API error: ${res.status}`);

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await ctx.replyMedia(buffer, 'image', {
        caption: `\u{1F3A8} *AI Generated Image*\n_Prompt:_ "${prompt}"`,
        mimetype: contentType,
      });
    } catch (err: any) {
      await ctx.reply(`\u274c Image generation failed: ${err.message || 'Please try again later.'}`);
    }
  },
};
