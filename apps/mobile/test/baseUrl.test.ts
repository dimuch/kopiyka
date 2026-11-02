import { describe, expect, it } from 'vitest';
import { nativeApiUrl } from '@/api/baseUrl';

describe('nativeApiUrl', () => {
  it.each([
    // [configured, dev, expected]
    ['https://kopiyka.englishplus.com.ua', false, 'https://kopiyka.englishplus.com.ua'], // release, https
    ['https://kopiyka.englishplus.com.ua', true, 'https://kopiyka.englishplus.com.ua'], // dev, https
    ['http://192.168.1.5:3000', true, 'http://192.168.1.5:3000'], // dev on a real iPhone: the Mac's LAN address
    ['http://localhost:3000', true, 'http://localhost:3000'], // dev in the simulator
    [undefined, true, 'http://localhost:3000'], // dev, nothing set
  ])('%s (dev %s) → %s', (configured, dev, expected) => {
    expect(nativeApiUrl(configured, dev)).toBe(expected);
  });

  it.each([
    ['http://kopiyka.englishplus.com.ua', /got http:\/\/kopiyka\.englishplus\.com\.ua/],
    [undefined, /got nothing/],
  ])('refuses %s in a release build', (configured, message) => {
    expect(() => nativeApiUrl(configured, false)).toThrow(/must be an https:\/\/ URL/);
    expect(() => nativeApiUrl(configured, false)).toThrow(message);
  });
});
