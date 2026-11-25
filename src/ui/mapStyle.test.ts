import { describe, expect, it } from 'vitest';
import { labelExpression } from './mapStyle';

describe('langue des libellés de carte', () => {
  it('français avec repli latin puis local', () => {
    expect(labelExpression('fr')).toEqual(['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]);
  });
  it('langue locale = nom d’origine', () => {
    expect(labelExpression('local')).toEqual(['get', 'name']);
  });
});
