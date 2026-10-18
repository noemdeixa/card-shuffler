import { describe, expect, it } from 'vitest'
import {
  buildShuffleRounds,
  createShufflePlan,
  generateRandomPermutation,
  MAX_CARDS,
  randomBelow,
  STACK_COUNT,
  type RandomUint32,
} from './shuffle'

function seededRandom(seed: number): RandomUint32 {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return (value ^ (value >>> 14)) >>> 0
  }
}

function dealAndGather(rounds: number[][], cardCount: number): number[] {
  let current = Array.from({ length: cardCount }, (_, card) => card)

  for (const round of rounds) {
    const piles = Array.from({ length: STACK_COUNT }, () => [] as number[])
    round.forEach((pile, index) => {
      piles[pile].unshift(current[index])
    })
    current = piles.flat()
  }

  return current
}

function* permutations(cards: number[], first = 0): Generator<number[]> {
  if (first === cards.length) {
    yield [...cards]
    return
  }

  for (let index = first; index < cards.length; index += 1) {
    ;[cards[first], cards[index]] = [cards[index], cards[first]]
    yield* permutations(cards, first + 1)
    ;[cards[first], cards[index]] = [cards[index], cards[first]]
  }
}

function chiSquared(observed: number[], expected: number): number {
  return observed.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
}

describe('randomBelow', () => {
  it('rejects values in the modulo-bias tail', () => {
    const values = [0xffff_ffff, 8]
    let calls = 0

    expect(randomBelow(3, () => values[calls++])).toBe(2)
    expect(calls).toBe(2)
  })

  it('rejects invalid limits and random-source values', () => {
    expect(() => randomBelow(0, () => 0)).toThrow(RangeError)
    expect(() => randomBelow(3, () => -1)).toThrow(RangeError)
    expect(() => randomBelow(3, () => 0x1_0000_0000)).toThrow(RangeError)
  })
})

describe('shuffle plan', () => {
  it.each([2, 15, 16, MAX_CARDS])(
    'deals and gathers %i cards into the exact target order',
    (cardCount) => {
      const plan = createShufflePlan(cardCount, seededRandom(cardCount))
      const expectedRounds = Math.ceil(Math.log(cardCount) / Math.log(STACK_COUNT))

      expect(plan.targetOrder).toHaveLength(cardCount)
      expect(plan.rounds).toHaveLength(expectedRounds)
      expect(dealAndGather(plan.rounds, cardCount)).toEqual(plan.targetOrder)
    },
  )

  it('reaches every target order for all permutations of decks up to 7 cards', () => {
    let checked = 0

    for (let cardCount = 2; cardCount <= 7; cardCount += 1) {
      for (const targetOrder of permutations(Array.from({ length: cardCount }, (_, card) => card))) {
        expect(dealAndGather(buildShuffleRounds(targetOrder), cardCount)).toEqual(targetOrder)
        checked += 1
      }
    }

    expect(checked).toBe(5912)
  })

  it('rejects target arrays that are not valid permutations', () => {
    const sparseTarget = [0, 1]
    delete sparseTarget[1]

    expect(() => buildShuffleRounds([0])).toThrow(RangeError)
    expect(() => buildShuffleRounds([0, 0])).toThrow(RangeError)
    expect(() => buildShuffleRounds([0, 2])).toThrow(RangeError)
    expect(() => buildShuffleRounds(sparseTarget)).toThrow(RangeError)
  })
})

describe('random permutation distribution', () => {
  it('uses the runtime secure random source by default', () => {
    const permutation = generateRandomPermutation(50)

    expect([...permutation].sort((left, right) => left - right))
      .toEqual(Array.from({ length: 50 }, (_, card) => card))
  })

  it('is close to uniform across permutations and card positions', () => {
    const trials = 12_000
    const cardCount = 4
    const expectedPerPermutation = trials / 24
    const expectedPerPosition = trials / cardCount
    const permutationCounts = new Map<string, number>()
    const positionCounts = Array.from({ length: cardCount }, () => Array(cardCount).fill(0) as number[])
    const nextUint32 = seededRandom(0x51f15e)

    for (let trial = 0; trial < trials; trial += 1) {
      const permutation = generateRandomPermutation(cardCount, nextUint32)
      const key = permutation.join(',')
      permutationCounts.set(key, (permutationCounts.get(key) ?? 0) + 1)

      permutation.forEach((card, position) => {
        positionCounts[position][card] += 1
      })
    }

    const allPermutationCounts = [...permutationCounts.values()]
    expect(allPermutationCounts).toHaveLength(24)
    expect(chiSquared(allPermutationCounts, expectedPerPermutation)).toBeLessThan(60)

    const allPositionCounts = positionCounts.flat()
    expect(chiSquared(allPositionCounts, expectedPerPosition)).toBeLessThan(45)
  })
})
