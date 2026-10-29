import { describe, expect, it } from 'vitest'
import {
  isAppHost,
  isReservedHost,
  isValidHost,
  normalizeHost,
} from '../../server/utils/hosts'
import { secureCompare } from '../../server/utils/secure-compare'

describe('normalizeHost', () => {
  it('lowercases and strips the port and trailing dot', () => {
    expect(normalizeHost(' Shop.Fern.com.:443 ')).toBe('shop.fern.com')
  })
})

describe('isValidHost', () => {
  it.each(['shop.fern.com', 'fern.co.uk', 'xn--bcher-kva.example'])(
    'accepts %s',
    (host) => expect(isValidHost(host)).toBe(true),
  )
  it.each(['fern', '-fern.com', 'fern..com', 'fe rn.com', 'https://a.com'])(
    'rejects %s',
    (host) => expect(isValidHost(host)).toBe(false),
  )
})

describe('isReservedHost', () => {
  it('blocks our own domain, its subdomains and APP_HOSTS', () => {
    expect(isReservedHost('shopfront.app')).toBe(true)
    expect(isReservedHost('admin.shopfront.app')).toBe(true)
    expect(isReservedHost('localhost')).toBe(true)
    expect(isReservedHost('notshopfront.app')).toBe(false)
  })
})

describe('isAppHost', () => {
  it('matches APP_HOSTS exactly', () => {
    expect(isAppHost('shopfront.app')).toBe(true)
    expect(isAppHost('fern.shopfront.app')).toBe(false)
  })
})

describe('secureCompare', () => {
  it('compares strings of any length', () => {
    expect(secureCompare('abc', 'abc')).toBe(true)
    expect(secureCompare('abd', 'abc')).toBe(false)
    expect(secureCompare('ab', 'abc')).toBe(false)
  })
})
