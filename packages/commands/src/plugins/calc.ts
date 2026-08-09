import { CommandPlugin } from '../types';

/**
 * Safe math expression evaluator — no eval, no new Function().
 * Supports: +, -, *, /, %, ** (^), (), unary minus, decimal numbers.
 * 
 * Uses a recursive descent parser so there is zero code injection risk.
 */
class SafeMathParser {
  private pos = 0;
  private expr = '';

  parse(expression: string): number {
    this.expr = expression.replace(/\^/g, '**').replace(/\s+/g, '');
    this.pos = 0;
    const result = this.parseAddSub();
    if (this.pos < this.expr.length) throw new Error('Unexpected character');
    return result;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.pos < this.expr.length && (this.expr[this.pos] === '+' || this.expr[this.pos] === '-')) {
      const op = this.expr[this.pos++];
      const right = this.parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePower();
    while (this.pos < this.expr.length && (this.expr[this.pos] === '*' || this.expr[this.pos] === '/' || this.expr[this.pos] === '%')) {
      const op = this.expr[this.pos];
      // handle ** exponentiation
      if (op === '*' && this.expr[this.pos + 1] === '*') {
        this.pos += 2;
        const right = this.parsePower();
        left = Math.pow(left, right);
      } else {
        this.pos++;
        const right = this.parsePower();
        if (op === '*') left *= right;
        else if (op === '/') {
          if (right === 0) throw new Error('Division by zero');
          left /= right;
        } else left %= right;
      }
    }
    return left;
  }

  private parsePower(): number {
    return this.parseUnary();
  }

  private parseUnary(): number {
    if (this.expr[this.pos] === '-') { this.pos++; return -this.parseAtom(); }
    if (this.expr[this.pos] === '+') { this.pos++; return this.parseAtom(); }
    return this.parseAtom();
  }

  private parseAtom(): number {
    if (this.expr[this.pos] === '(') {
      this.pos++; // consume (
      const val = this.parseAddSub();
      if (this.expr[this.pos] !== ')') throw new Error('Missing closing parenthesis');
      this.pos++; // consume )
      return val;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    const start = this.pos;
    if (this.pos < this.expr.length && (this.expr[this.pos] >= '0' && this.expr[this.pos] <= '9' || this.expr[this.pos] === '.')) {
      while (this.pos < this.expr.length && (this.expr[this.pos] >= '0' && this.expr[this.pos] <= '9' || this.expr[this.pos] === '.')) {
        this.pos++;
      }
      const num = parseFloat(this.expr.substring(start, this.pos));
      if (isNaN(num)) throw new Error('Invalid number');
      return num;
    }
    throw new Error(`Unexpected token at position ${this.pos}: "${this.expr[this.pos]}"`);
  }
}

export const calcCommand: CommandPlugin = {
  name: 'calc',
  aliases: ['math', 'calculate', '='],
  description: 'Safely evaluate mathematical expressions',
  category: 'utility',
  ownerOnly: false,
  enabled: true,
  cooldown: 2,
  execute: async (ctx) => {
    const expr = ctx.args.join('').trim();
    if (!expr) {
      return await ctx.reply(`\u{1F522} *Usage:* \`${ctx.prefix}calc <expression>\` (e.g. \`${ctx.prefix}calc (100 * 5) / 2 + 15\`)`);
    }

    // Guard: allow only safe math characters before parsing
    if (/[^0-9\+\-\*\/\%\(\)\^\.\s]/g.test(expr)) {
      return await ctx.reply('\u274c Invalid expression. Only basic arithmetic operators (+, -, *, /, %, ^) and numbers are allowed.');
    }

    try {
      const parser = new SafeMathParser();
      const result = parser.parse(expr);

      if (!isFinite(result)) {
        return await ctx.reply('\u274c Invalid math result (division by zero or overflow).');
      }

      // Round to 10 decimal places to avoid floating point noise
      const display = parseFloat(result.toFixed(10));
      await ctx.reply(`\u{1F522} *MATH CALCULATION*\n\u2022 *Expression:* \`${expr}\`\n\u2022 *Result:* \`${display}\``);
    } catch (err: any) {
      await ctx.reply(`\u274c ${err.message || 'Could not evaluate expression. Please check syntax.'}`);
    }
  },
};
