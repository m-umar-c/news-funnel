import { describe, expect, it } from 'vitest';
import { assertPublicUrl, isPrivateAddress } from '../src/lib/safeFetch.js';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fe80::1', 'fd00::5', '::ffff:10.0.0.1'])(
    'blocks %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe('assertPublicUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(/protocol/);
  });

  it('rejects private literals', async () => {
    await expect(assertPublicUrl('http://127.0.0.1:5432/')).rejects.toThrow(/private/);
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow(/private/);
  });

  it('accepts a public ip literal', async () => {
    await expect(assertPublicUrl('https://1.1.1.1/feed')).resolves.toBeInstanceOf(URL);
  });
});
