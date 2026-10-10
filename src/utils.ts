import type { ToolResult } from './types';

export function isSuccess<T>(result: ToolResult<T>): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isError<T>(result: ToolResult<T>): result is { ok: false; error: string } {
  return result.ok === false;
}

export function success<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function error(message: string): ToolResult<never> {
  return { ok: false, error: message };
}

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  return value;
}

export function assertNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number`);
  }
  return value;
}

export function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

export function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string or omitted`);
  }
  return value;
}

export function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value;
}

const SAFE_TAGS = ['p', 'br', 'span', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style', 'svg', 'math', 'link', 'meta'];

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let result = html;

  result = result.replace(/<(\w+)/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    if (DANGEROUS_TAGS.includes(lowerTag) || !SAFE_TAGS.includes(lowerTag)) {
      return `<removed-${lowerTag}`;
    }
    return match;
  });

  result = result.replace(/<\/?(\w+)/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    if (DANGEROUS_TAGS.includes(lowerTag) || !SAFE_TAGS.includes(lowerTag)) {
      return `<removed-${lowerTag}>`;
    }
    return match;
  });

  result = result.replace(/<a\s+([^>]+)>/gi, (match, attrs) => {
    let cleanAttrs = attrs;
    if (cleanAttrs.includes('href')) {
      if (cleanAttrs.match(/href=["']javascript:/i) || cleanAttrs.match(/href=["']data:/i)) {
        cleanAttrs = cleanAttrs.replace(/href=["'][^"']*["']/i, 'href="#"');
      }
    }
    cleanAttrs = cleanAttrs.replace(/\s*on\w+=["'][^"']*["']/gi, '');
    return `<a ${cleanAttrs}>`;
  });

  result = result.replace(/\s*on\w+=["'][^"']*["']/gi, '');

  return result;
}
