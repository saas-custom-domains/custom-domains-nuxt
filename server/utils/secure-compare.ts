import { timingSafeEqual } from 'node:crypto'

// Constant-time string comparison, so a wrong guess doesn't reveal
// how many leading characters were right.
export function secureCompare(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
