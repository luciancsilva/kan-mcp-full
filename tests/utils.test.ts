import { describe, test, expect } from 'bun:test';
import {
  isSuccess,
  isError,
  success,
  error,
  assertString,
  assertNumber,
  assertOptionalString,
  assertArray,
  sanitizeHtml,
} from '../src/utils';

describe('utils', () => {
  describe('isSuccess', () => {
    test('returns true for success result', () => {
      const result = success({ id: '1' });
      expect(isSuccess(result)).toBe(true);
      expect(isError(result)).toBe(false);
    });

    test('returns false for error result', () => {
      const result = error('something went wrong');
      expect(isSuccess(result)).toBe(false);
    });
  });

  describe('isError', () => {
    test('returns true for error result', () => {
      const result = error('failed');
      expect(isError(result)).toBe(true);
      expect(isSuccess(result)).toBe(false);
    });

    test('returns false for success result', () => {
      const result = success({ id: '1' });
      expect(isError(result)).toBe(false);
    });
  });

  describe('assertString', () => {
    test('returns string when value is a string', () => {
      expect(assertString('hello', 'name')).toBe('hello');
    });

    test('throws when value is not a string', () => {
      expect(() => assertString(123, 'name')).toThrow('name must be a string');
      expect(() => assertString(null, 'name')).toThrow('name must be a string');
      expect(() => assertString(undefined, 'name')).toThrow('name must be a string');
      expect(() => assertString({}, 'name')).toThrow('name must be a string');
    });

    test('throws for edge non-string types', () => {
      expect(() => assertString(NaN, 'name')).toThrow('name must be a string');
      expect(() => assertString(Symbol('test'), 'name')).toThrow('name must be a string');
      expect(() => assertString(BigInt(1), 'name')).toThrow('name must be a string');
      expect(() => assertString(true, 'name')).toThrow('name must be a string');
      expect(() => assertString(false, 'name')).toThrow('name must be a string');
      expect(() => assertString([], 'name')).toThrow('name must be a string');
    });
  });

  describe('assertNumber', () => {
    test('returns number when value is a number', () => {
      expect(assertNumber(42, 'age')).toBe(42);
      expect(assertNumber(0, 'count')).toBe(0);
      expect(assertNumber(-10, 'value')).toBe(-10);
    });

    test('throws when value is not a number', () => {
      expect(() => assertNumber('42', 'age')).toThrow('age must be a number');
      expect(() => assertNumber(null, 'age')).toThrow('age must be a number');
      expect(() => assertNumber(undefined, 'age')).toThrow('age must be a number');
      expect(() => assertNumber({}, 'age')).toThrow('age must be a number');
    });

    test('throws for edge non-number types', () => {
      expect(() => assertNumber(BigInt(1), 'age')).toThrow('age must be a number');
      expect(() => assertNumber(Symbol('test'), 'age')).toThrow('age must be a number');
      expect(() => assertNumber([], 'age')).toThrow('age must be a number');
    });

    test('accepts special numeric values (typeof is number)', () => {
      expect(assertNumber(NaN, 'age')).toBeNaN();
      expect(assertNumber(Infinity, 'age')).toBe(Infinity);
      expect(assertNumber(-Infinity, 'age')).toBe(-Infinity);
    });
  });

  describe('assertOptionalString', () => {
    test('returns undefined for undefined', () => {
      expect(assertOptionalString(undefined, 'name')).toBeUndefined();
    });

    test('returns undefined for null', () => {
      expect(assertOptionalString(null, 'name')).toBeUndefined();
    });

    test('returns string for valid string', () => {
      expect(assertOptionalString('hello', 'name')).toBe('hello');
    });

    test('throws when value is not string null or undefined', () => {
      expect(() => assertOptionalString(123, 'name')).toThrow('name must be a string or omitted');
      expect(() => assertOptionalString({}, 'name')).toThrow('name must be a string or omitted');
    });

    test('accepts empty string as valid', () => {
      expect(assertOptionalString('', 'name')).toBe('');
    });

    test('throws for other falsy non-null values', () => {
      expect(() => assertOptionalString(0, 'name')).toThrow('name must be a string or omitted');
      expect(() => assertOptionalString(false, 'name')).toThrow('name must be a string or omitted');
      expect(() => assertOptionalString(NaN, 'name')).toThrow('name must be a string or omitted');
    });
  });

  describe('assertArray', () => {
    test('returns array when value is an array', () => {
      expect(assertArray([1, 2, 3], 'items')).toEqual([1, 2, 3]);
      expect(assertArray([], 'items')).toEqual([]);
      expect(assertArray(['a', 'b'], 'items')).toEqual(['a', 'b']);
    });

    test('throws when value is not an array', () => {
      expect(() => assertArray('not-an-array', 'items')).toThrow('items must be an array');
      expect(() => assertArray({}, 'items')).toThrow('items must be an array');
      expect(() => assertArray(null, 'items')).toThrow('items must be an array');
      expect(() => assertArray(undefined, 'items')).toThrow('items must be an array');
      expect(() => assertArray(123, 'items')).toThrow('items must be an array');
    });

    test('throws for array-like and collection types', () => {
      expect(() => assertArray(new Set([1, 2]), 'items')).toThrow('items must be an array');
      expect(() => assertArray(new Map(), 'items')).toThrow('items must be an array');
      expect(() => assertArray(new Date(), 'items')).toThrow('items must be an array');
    });

    test('accepts sparse arrays', () => {
      const sparse = [, ,];
      expect(assertArray(sparse, 'items')).toEqual(sparse);
    });
  });

  describe('sanitizeHtml', () => {
    test('returns empty string for falsy input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as unknown as string)).toBe('');
      expect(sanitizeHtml(undefined as unknown as string)).toBe('');
    });

    test('returns empty string for non-string input', () => {
      expect(sanitizeHtml(123 as unknown as string)).toBe('');
      expect(sanitizeHtml({} as unknown as string)).toBe('');
    });

    test('keeps safe tags', () => {
      expect(sanitizeHtml('<p>Hello</p>')).toBe('<p>Hello</p>');
      expect(sanitizeHtml('<strong>bold</strong>')).toBe('<strong>bold</strong>');
      expect(sanitizeHtml('<h1>Title</h1>')).toBe('<h1>Title</h1>');
    });

    test('removes dangerous tags', () => {
      expect(sanitizeHtml('<script>alert(1)</script>')).toContain('removed-script');
      expect(sanitizeHtml('<iframe src="evil"></iframe>')).toContain('removed-iframe');
      expect(sanitizeHtml('<form><input></form>')).toContain('removed-form');
    });

    test('removes unknown tags', () => {
      expect(sanitizeHtml('<custom>content</custom>')).toContain('removed-custom');
    });

    test('sanitizes anchor href attributes', () => {
      expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a href="#">click</a>');
      expect(sanitizeHtml('<a href="https://example.com">safe</a>')).toBe('<a href="https://example.com">safe</a>');
    });

    test('removes event handlers', () => {
      expect(sanitizeHtml('<div onclick="alert(1)">test</div>')).not.toContain('onclick');
      expect(sanitizeHtml('<span onmouseover="hack()">text</span>')).not.toContain('onmouseover');
    });
  });
});
