import { describe, expect, it } from 'vitest';
import { ipKey } from '../src/auth/ipKey.js';

describe('ipKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002::1', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%en0', 'fe80:0:0:0::/64'],
    ['64:ff9b::203.0.113.7', '64:ff9b:0:0::/64'],
  ])('%s → %s', (ip, expected) => {
    expect(ipKey(ip)).toBe(expected);
  });

  it('puts addresses from the same /64 under one key', () => {
    expect(ipKey('2a02:2378:1:2:1111::1')).toBe(ipKey('2a02:2378:1:2:9999:8888:7777:6666'));
    expect(ipKey('2a02:2378:1:2::1')).not.toBe(ipKey('2a02:2378:1:3::1'));
  });
});
