import { expandDialectSearchTerms } from '../shared/utils/dialectSearch.js';

describe('dialectSearch utility', () => {
    it('expands Arabic dialect aliases for mobile-related terms', () => {
        const terms = expandDialectSearchTerms('موبايل');

        expect(terms).toContain('موبايل');
        expect(terms).toContain('جوال');
        expect(terms).toContain('هاتف');
        expect(terms).toContain('mobile');
    });

    it('returns empty list for blank input', () => {
        const terms = expandDialectSearchTerms('   ');
        expect(terms).toEqual([]);
    });
});
