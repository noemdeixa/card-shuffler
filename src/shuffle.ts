export const STACK_COUNT = 15
export const MAX_CARDS = STACK_COUNT ** 2

const UINT32_RANGE = 0x1_0000_0000

export interface ShufflePlan {
  targetOrder: number[]
  rounds: number[][]
}

export type RandomUint32 = () => number

function secureRandomUint32(): number {
  const value = new Uint32Array(1)
  globalThis.crypto.getRandomValues(value)
  return value[0]
}

export function randomBelow(limit: number, nextUint32: RandomUint32 = secureRandomUint32): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > UINT32_RANGE) {
    throw new RangeError(`Random limit must be an integer between 1 and ${UINT32_RANGE}.`)
  }

  const acceptedRange = Math.floor(UINT32_RANGE / limit) * limit
  let value: number

  do {
    value = nextUint32()
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new RangeError('Random source must return an unsigned 32-bit integer.')
    }
  } while (value >= acceptedRange)

  return value % limit
}

export function generateRandomPermutation(
  cardCount: number,
  nextUint32: RandomUint32 = secureRandomUint32,
): number[] {
  if (!Number.isInteger(cardCount) || cardCount < 2 || cardCount > MAX_CARDS) {
    throw new RangeError(`Card count must be an integer between 2 and ${MAX_CARDS}.`)
  }

  const permutation = Array.from({ length: cardCount }, (_, card) => card)

  // Fisher–Yates with an unbiased index at every step.
  for (let index = permutation.length - 1; index > 0; index -= 1) {
    const otherIndex = randomBelow(index + 1, nextUint32)
    ;[permutation[index], permutation[otherIndex]] = [permutation[otherIndex], permutation[index]]
  }

  return permutation
}

export function buildShuffleRounds(targetOrder: readonly number[]): number[][] {
  const cardCount = targetOrder.length
  if (!Number.isInteger(cardCount) || cardCount < 2 || cardCount > MAX_CARDS) {
    throw new RangeError(`Target order must contain between 2 and ${MAX_CARDS} cards.`)
  }

  const seen = new Set<number>()
  for (const card of targetOrder) {
    if (!Number.isInteger(card) || card < 0 || card >= cardCount || seen.has(card)) {
      throw new RangeError('Target order must be a permutation of card indexes.')
    }
    seen.add(card)
  }

  const roundCount = Math.ceil(Math.log(cardCount) / Math.log(STACK_COUNT))
  const targetPosition = new Array<number>(cardCount)
  targetOrder.forEach((card, position) => {
    targetPosition[card] = position
  })

  const rounds: number[][] = []
  let current = Array.from({ length: cardCount }, (_, card) => card)
  let reverse = roundCount % 2 === 0

  // Each pass sorts by the next base-15 digit of each card's target position.
  for (let round = 0; round < roundCount; round += 1) {
    const piles = Array.from({ length: STACK_COUNT }, () => [] as number[])
    const instructions: number[] = []

    for (const card of current) {
      let pile = Math.floor(targetPosition[card] / STACK_COUNT ** round) % STACK_COUNT
      if (reverse) pile = STACK_COUNT - 1 - pile
      instructions.push(pile)
      // Cards are placed on top; unshift models their order after gathering a pile.
      piles[pile].unshift(card)
    }

    rounds.push(instructions)
    // The user gathers pile 1 first, so this is the next round's top-to-bottom order.
    current = piles.flat()
    reverse = !reverse
  }

  return rounds
}

export function createShufflePlan(
  cardCount: number,
  nextUint32: RandomUint32 = secureRandomUint32,
): ShufflePlan {
  const targetOrder = generateRandomPermutation(cardCount, nextUint32)
  return {
    targetOrder,
    rounds: buildShuffleRounds(targetOrder),
  }
}
