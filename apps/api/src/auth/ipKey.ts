import { isIPv4, isIPv6 } from 'node:net';

/**
 * The value an IP is throttled under: IPv4 as-is, IPv6 reduced to its /64,
 * since one home connection typically gets a whole /64 to rotate through.
 */
export function ipKey(ip: string): string {
  const addr = ip.split('%')[0]!; // drop an IPv6 zone id
  if (addr.toLowerCase().startsWith('::ffff:') && isIPv4(addr.slice(7))) return addr.slice(7);
  if (!isIPv6(addr)) return addr;
  return `${expandIPv6(addr).slice(0, 4).join(':')}::/64`;
}

function expandIPv6(addr: string): string[] {
  let text = addr.toLowerCase();
  // An embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) becomes two hex groups.
  const v4 = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4[1]!.split('.').map(Number) as [number, number, number, number];
    text = text.slice(0, -v4[1]!.length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', tail] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].map((g) => parseInt(g, 16).toString(16));
}
