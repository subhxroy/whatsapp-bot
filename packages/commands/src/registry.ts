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
import { groupCommand, promoteCommand, demoteCommand, kickCommand, tagAllCommand } from './plugins/group';
import { antilinkCommand } from './plugins/antilink';
import { ytmp3Command, ytmp4Command } from './plugins/downloader';
import { vvCommand } from './plugins/vv';
import { birthdayCommand } from './plugins/birthday';
import { idCommand } from './plugins/id';
import { calcCommand } from './plugins/calc';

class CommandRegistry {
  private commands: Map<string, CommandPlugin> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  private registerDefaultCommands() {
    const defaults = [
      pingCommand,
      menuCommand,
      helpCommand,
      aboutCommand,
      ownerCommand,
      settingsCommand,
      stickerCommand,
      toImgCommand,
      aiCommand,
      groupCommand,
      promoteCommand,
      demoteCommand,
      kickCommand,
      tagAllCommand,
      antilinkCommand,
      ytmp3Command,
      ytmp4Command,
      vvCommand,
      birthdayCommand,
      idCommand,
      calcCommand,
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
