import { describe, it, expect } from 'vitest';
import { validateInput, ValidationError } from '../../src/utils/validation';
import { z } from 'zod';

describe('Validation Utils', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
    email: z.string().email().optional(),
  });

  describe('validateInput', () => {
    it('should validate correct input', () => {
      const input = { name: 'John', age: 30 };
      const result = validateInput(testSchema, input);
      expect(result).toEqual(input);
    });

    it('should throw ValidationError for invalid input', () => {
      const input = { name: '', age: -5 };
      expect(() => validateInput(testSchema, input)).toThrow(ValidationError);
    });

    it('should validate with optional fields', () => {
      const input = { name: 'John', age: 30, email: 'john@example.com' };
      const result = validateInput(testSchema, input);
      expect(result).toEqual(input);
    });

    it('should reject invalid email format', () => {
      const input = { name: 'John', age: 30, email: 'invalid-email' };
      expect(() => validateInput(testSchema, input)).toThrow(ValidationError);
    });
  });
});
