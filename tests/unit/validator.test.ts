/**
 * Unit tests for URL validator.
 */

import { describe, it, expect } from 'vitest';
import { validateUrl } from '../../src/utils/validator.js';

describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('should accept valid http URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('http://example.com/');
    });

    it('should accept valid https URL', () => {
      const result = validateUrl('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
    });

    it('should accept URL with path', () => {
      const result = validateUrl('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/path/to/page');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/path/to/page');
    });

    it('should accept URL with query parameters', () => {
      const result = validateUrl('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/search?q=test');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/search?q=test');
    });

    it('should accept URL with port', () => {
      const result = validateUrl('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy:8080/api');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy:8080/api');
    });

    it('should trim whitespace from URL', () => {
      const result = validateUrl('  https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy  ');
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
    });
  });

  describe('invalid URLs', () => {
    it('should reject empty string', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateUrl('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL cannot be empty');
    });

    it('should reject URL without protocol', () => {
      const result = validateUrl('example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject file:// protocol', () => {
      const result = validateUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid protocol');
    });

    it('should reject ftp:// protocol', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid protocol');
    });

    it('should reject javascript: protocol', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid protocol');
    });

    it('should reject malformed URL', () => {
      const result = validateUrl('https://');
      expect(result.valid).toBe(false);
    });
  });
});
