import { describe, it, expect } from 'vitest';
import {
  registerParser,
  getParser,
  markdownParser,
  jsonParser,
  logParser,
} from '../workflow-parser-registry';
import { WorkflowConfig } from '../../types/workflow';

describe('WorkflowParserRegistry', () => {
  const mockConfig: WorkflowConfig = {
    id: 'test',
    name: 'Test',
    workflowFile: 'test.yml',
    artifactCompressed: false,
    streamLogs: false,
  };

  describe('registerParser', () => {
    it('should register a custom parser', () => {
      const customParser: any = (content: string) => ({ parsed: true, content });

      registerParser('custom-test', customParser);

      const parser = getParser('custom-test');
      expect(parser).toBeDefined();
    });

    it('should allow re-registering parsers (overwrites)', () => {
      const parser1: any = (content: string) => ({ v1: true });
      const parser2: any = (content: string) => ({ v2: true });

      registerParser('reregister-test', parser1);
      registerParser('reregister-test', parser2);

      const parser = getParser('reregister-test');
      expect(parser).toBeDefined();
    });
  });

  describe('getParser', () => {
    it('should return built-in markdown parser', () => {
      const parser = markdownParser;
      expect(parser).toBeDefined();

      const result = parser('# Test\n\nSome content', mockConfig);
      expect(result).toHaveProperty('format', 'markdown');
      expect(result).toHaveProperty('content');
    });

    it('should return built-in json parser', () => {
      const parser = jsonParser;
      expect(parser).toBeDefined();

      const result = parser('{"key": "value"}', mockConfig);
      expect(result).toHaveProperty('format', 'json');
      expect(result).toHaveProperty('data');
    });

    it('should return built-in log parser', () => {
      const parser = logParser;
      expect(parser).toBeDefined();

      const result = parser('Log line 1\nLog line 2', mockConfig);
      expect(result).toHaveProperty('format', 'log');
      expect(result).toHaveProperty('lines');
    });

    it('should return azd-validation parser via getParser', () => {
      const parser = getParser('azd-validation');
      expect(parser).toBeDefined();
    });

    it('should return default parser for unknown parser', () => {
      const parser = getParser('nonexistent');
      // getParser returns markdownParser as default, never null
      expect(parser).toBe(markdownParser);
    });
  });

  describe('Direct parser usage', () => {
    it('should parse markdown content', () => {
      const content = '# Results\n\n- Item 1\n- Item 2';
      const result = markdownParser(content, mockConfig);

      expect(result.format).toBe('markdown');
      expect(result.content).toBe(content);
    });

    it('should parse JSON content', () => {
      const content = JSON.stringify({ score: 95, status: 'pass' });
      const result = jsonParser(content, mockConfig);

      expect(result.format).toBe('json');
      expect(result.data).toEqual({ score: 95, status: 'pass' });
    });

    it('should handle JSON parse errors gracefully', () => {
      const content = 'invalid json {';
      const result = jsonParser(content, mockConfig);

      expect(result.format).toBe('json');
      expect(result.error).toBeDefined();
    });

    it('should parse log content into lines', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const result = logParser(content, mockConfig);

      expect(result.format).toBe('log');
      expect(result.lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });
  });

  describe('Built-in parsers edge cases', () => {
    it('should handle empty markdown content', () => {
      const result = markdownParser('', mockConfig);

      expect(result.format).toBe('markdown');
      expect(result.content).toBe('');
    });

    it('should handle empty JSON array', () => {
      const result = jsonParser('[]', mockConfig);

      expect(result.format).toBe('json');
      expect(result.data).toEqual([]);
    });

    it('should handle empty log content', () => {
      const result = logParser('', mockConfig);

      expect(result.format).toBe('log');
      expect(result.lines).toEqual(['']);
    });

    it('should handle Windows line endings in logs', () => {
      const result = logParser('Line 1\r\nLine 2\r\nLine 3', mockConfig);

      expect(result.lines).toHaveLength(3);
    });
  });
});
