import { CommandPlugin } from './types';
import { pingCommand } from './plugins/ping';
import { menuCommand } from './plugins/menu';
import { helpCommand } from './plugins/help';
import { aboutCommand } from './plugins/about';
import { ownerCommand } from './plugins/owner';
import { settingsCommand } from './plugins/settings';
import { stickerCommand } from './plugins/sticker';
import { toImgCommand } from './plugins/toimg';
import { aiCommand } from './plugins/ai';
import {
  groupCommand,
  promoteCommand,
  demoteCommand,
  kickCommand,
  tagAllCommand,
  hidetagCommand,
  groupInfoCommand,
  linkCommand,
} from './plugins/group';
import { antilinkCommand } from './plugins/antilink';
import { ytmp3Command, ytmp4Command } from './plugins/downloader';
import { vvCommand } from './plugins/vv';
import { birthdayCommand } from './plugins/birthday';
import { idCommand } from './plugins/id';
import { calcCommand } from './plugins/calc';
import { pollCommand } from './plugins/poll';
import { toAudioCommand } from './plugins/toaudio';
import { toGifCommand } from './plugins/togif';
import { adminsCommand } from './plugins/admins';
import {
  translateCommand,
  weatherCommand,
  dictCommand,
  shortenCommand,
  qrcodeCommand,
} from './plugins/utility';
import {
  rollCommand,
  flipCommand,
  quoteCommand,
  jokeCommand,
  triviaCommand,
  factCommand,
  eightBallCommand,
} from './plugins/fun';
import {
  systemCommand,
  evalCommand,
  restartCommand,
} from './plugins/system';
// ✨ New commands (43 → 51)
import {
  timeCommand,
  currencyCommand,
  remindCommand,
  emojiCommand,
  roastCommand,
  summarizeCommand,
  imagineCommand,
} from './plugins/extras';

class CommandRegistry {
  private commands: Map<string, CommandPlugin> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  private registerDefaultCommands() {
    const defaults = [
      // === GENERAL ===
      pingCommand,
      menuCommand,
      helpCommand,
      aboutCommand,
      ownerCommand,

      // === SETTINGS / SYSTEM ===
      settingsCommand,
      systemCommand,
      evalCommand,
      restartCommand,

      // === MEDIA ===
      stickerCommand,
      toImgCommand,
      toAudioCommand,
      toGifCommand,
      vvCommand,

      // === AI ===
      aiCommand,
      summarizeCommand,    // NEW #44
      imagineCommand,      // NEW #45

      // === GROUP MANAGEMENT ===
      groupCommand,
      promoteCommand,
      demoteCommand,
      kickCommand,
      tagAllCommand,
      hidetagCommand,
      groupInfoCommand,
      linkCommand,
      antilinkCommand,
      adminsCommand,

      // === UTILITY ===
      translateCommand,
      weatherCommand,
      dictCommand,
      shortenCommand,
      qrcodeCommand,
      calcCommand,
      pollCommand,
      birthdayCommand,
      idCommand,
      timeCommand,         // NEW #46
      currencyCommand,     // NEW #47
      remindCommand,       // NEW #48
      ytmp3Command,
      ytmp4Command,

      // === FUN ===
      rollCommand,
      flipCommand,
      quoteCommand,
      jokeCommand,
      triviaCommand,
      factCommand,
      eightBallCommand,
      emojiCommand,        // NEW #49
      roastCommand,        // NEW #50
    ];

    for (const cmd of defaults) {
      this.register(cmd);
    }
  }

  public register(plugin: CommandPlugin) {
    this.commands.set(plugin.name.toLowerCase(), plugin);
    for (const alias of plugin.aliases) {
      this.aliases.set(alias.toLowerCase(), plugin.name.toLowerCase());
    }
  }

  public getCommand(nameOrAlias: string): CommandPlugin | undefined {
    const key = nameOrAlias.toLowerCase();
    const commandName = this.commands.has(key) ? key : this.aliases.get(key);
    if (!commandName) return undefined;
    return this.commands.get(commandName);
  }

  public getAllCommands(): CommandPlugin[] {
    return Array.from(this.commands.values());
  }
}

export const registry = new CommandRegistry();
