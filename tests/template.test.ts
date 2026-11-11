import { describe, expect, it } from 'vitest';
import { fillTokens } from '../src/lib/template';

describe('location tokens', () => {
  it('fills northern and southern values', () => {
    const ny = { name: 'New York', lat: 40.7, lon: -74, tz: 'America/New_York' };
    const syd = { name: 'Sydney', lat: -33.9, lon: 151.2, tz: 'Australia/Sydney' };
    expect(fillTokens('From {{place}} ({{lat}}) the {{pole}} is {{poleAltitude}} up; stars beyond {{circumpolarLimit}} never set.', ny)).toBe('From New York (41°N) the north celestial pole is 41° up; stars beyond +49° never set.');
    expect(fillTokens('Look {{equatorSide}}. {{poleStar}}.', syd)).toBe('Look north. the south celestial pole (which has no bright pole star).');
    expect(fillTokens('no tokens', syd)).toBe('no tokens');
    expect(fillTokens('{{unknown}}', syd)).toBe('{{unknown}}');
  });
});
