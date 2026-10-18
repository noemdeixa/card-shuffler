import './style.css'

const STACK_COUNT = 15
const MAX_CARDS = STACK_COUNT ** 2

type ShufflePhase = 'dealing' | 'round-complete' | 'complete'

interface ShuffleSession {
  cardCount: number
  rounds: number[][]
  roundIndex: number
  cardIndex: number
  phase: ShufflePhase
}

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="Card Shuffler home">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span>Card Shuffler</span>
    </a>
    <span class="offline-note">No account. No deck list.</span>
  </header>

  <main>
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">A better shuffle, one card at a time</p>
      <h1 id="page-title">Give your deck<br><span>a fresh deal.</span></h1>
      <p class="intro-copy">Sort your cards into piles with a little help from a random permutation. Your cards never leave the table — this app just tells you where to put them.</p>
    </section>

    <section class="panel setup-panel" id="setup-panel" aria-labelledby="setup-title">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">First, set your deck size</p>
          <h2 id="setup-title">Ready when you are</h2>
        </div>
        <span class="deck-icon" aria-hidden="true">♠</span>
      </div>
      <form id="setup-form">
        <label for="card-count">Number of cards</label>
        <div class="setup-row">
          <input id="card-count" name="card-count" type="number" min="2" max="${MAX_CARDS}" step="1" value="100" required inputmode="numeric">
          <span class="input-suffix">cards</span>
          <button class="button button-primary" type="submit">Start shuffling <span aria-hidden="true">→</span></button>
        </div>
        <p class="field-hint">Choose between 2 and ${MAX_CARDS} cards. Decks over ${STACK_COUNT} cards take 2 rounds through ${STACK_COUNT} piles.</p>
      </form>
    </section>

    <section class="panel session-panel" id="session-panel" aria-labelledby="session-title" hidden>
      <div class="session-topline">
        <div>
          <p class="eyebrow" id="round-label"></p>
          <h2 id="session-title"></h2>
        </div>
        <button class="text-button" id="restart-button" type="button">Start over</button>
      </div>
      <div class="progress-track" role="progressbar" id="progress-track" aria-label="Shuffle progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span class="progress-fill" id="progress-fill"></span>
      </div>
      <div class="instruction" id="instruction" aria-live="polite"></div>
      <div class="pile-grid" id="pile-grid" aria-label="${STACK_COUNT} numbered card piles"></div>
      <div class="session-footer">
        <p class="card-counter" id="card-counter"></p>
        <div class="session-actions">
          <button class="button button-secondary" id="undo-button" type="button">← Undo</button>
          <div class="auto-control">
            <button class="button button-secondary" id="auto-button" type="button" aria-pressed="false">▶ Auto</button>
            <label class="interval-control" for="auto-interval">Every
              <input id="auto-interval" type="number" min="0.3" max="10" step="0.1" value="1" required inputmode="decimal" aria-label="Auto interval in seconds">
              <span>sec</span>
            </label>
          </div>
          <button class="button button-primary" id="next-button" type="button"></button>
        </div>
      </div>
    </section>
    <p class="status-message" id="status-message" role="status" aria-live="polite"></p>
  </main>
  <footer>
    <span>Made for tabletop shuffling.</span>
    <span>15 piles · up to ${MAX_CARDS} cards</span>
  </footer>
`

const orientationPrompt = document.createElement('div')
orientationPrompt.className = 'orientation-prompt'
orientationPrompt.setAttribute('role', 'status')
orientationPrompt.innerHTML = '<span class="orientation-icon" aria-hidden="true">↻</span><strong>Turn your phone sideways</strong><span>The shuffle screen is designed for landscape.</span>'
document.body.append(orientationPrompt)

const setupForm = document.querySelector<HTMLFormElement>('#setup-form')!
const cardCountInput = document.querySelector<HTMLInputElement>('#card-count')!
const setupPanel = document.querySelector<HTMLElement>('#setup-panel')!
const sessionPanel = document.querySelector<HTMLElement>('#session-panel')!
const roundLabel = document.querySelector<HTMLElement>('#round-label')!
const sessionTitle = document.querySelector<HTMLElement>('#session-title')!
const progressTrack = document.querySelector<HTMLElement>('#progress-track')!
const progressFill = document.querySelector<HTMLElement>('#progress-fill')!
const instruction = document.querySelector<HTMLElement>('#instruction')!
const cardCounter = document.querySelector<HTMLElement>('#card-counter')!
const nextButton = document.querySelector<HTMLButtonElement>('#next-button')!
const undoButton = document.querySelector<HTMLButtonElement>('#undo-button')!
const autoButton = document.querySelector<HTMLButtonElement>('#auto-button')!
const autoIntervalInput = document.querySelector<HTMLInputElement>('#auto-interval')!
const restartButton = document.querySelector<HTMLButtonElement>('#restart-button')!
const statusMessage = document.querySelector<HTMLElement>('#status-message')!
const portraitPhone = window.matchMedia('(orientation: portrait) and (max-width: 700px)')
const pileElements: HTMLButtonElement[] = []
const pileGrid = document.querySelector<HTMLDivElement>('#pile-grid')!

for (let pile = 1; pile <= STACK_COUNT; pile += 1) {
  const pileElement = document.createElement('button')
  pileElement.className = 'pile'
  pileElement.type = 'button'
  pileElement.disabled = true
  pileElement.setAttribute('aria-label', `Pile ${pile}`)
  pileElement.innerHTML = `<span class="pile-card-marker" aria-hidden="true"></span><span class="pile-number">${pile}</span><span class="pile-label">PILE</span>`
  pileGrid.append(pileElement)
  pileElements.push(pileElement)
}

let session: ShuffleSession | null = null
let autoTimer: number | undefined

function setSessionView(active: boolean): void {
  document.body.classList.toggle('session-active', active)
  sessionPanel.inert = active && portraitPhone.matches
}

function updateOrientationInert(): void {
  sessionPanel.inert = Boolean(session && portraitPhone.matches)
}

portraitPhone.addEventListener('change', updateOrientationInert)
window.addEventListener('resize', updateOrientationInert)

function stopAuto(): void {
  if (autoTimer !== undefined) {
    window.clearInterval(autoTimer)
    autoTimer = undefined
  }
  autoButton.textContent = '▶ Auto'
  autoButton.setAttribute('aria-pressed', 'false')
}

function startAuto(): void {
  if (!session || session.phase !== 'dealing') return

  const interval = autoIntervalInput.valueAsNumber
  if (!Number.isFinite(interval) || interval < 0.3 || interval > 10) {
    stopAuto()
    autoIntervalInput.reportValidity()
    return
  }

  stopAuto()
  autoButton.textContent = 'Ⅱ Pause'
  autoButton.setAttribute('aria-pressed', 'true')
  autoTimer = window.setInterval(() => {
    if (!session || session.phase !== 'dealing') {
      stopAuto()
      return
    }
    nextButton.click()
  }, interval * 1000)
}

function randomBelow(limit: number): number {
  const range = 0x1_0000_0000
  const acceptedRange = Math.floor(range / limit) * limit
  const value = new Uint32Array(1)

  // Reject the unused tail so every pile index has the same probability.
  do {
    window.crypto.getRandomValues(value)
  } while (value[0] >= acceptedRange)

  return value[0] % limit
}

function generateRounds(cardCount: number): number[][] {
  const roundCount = Math.ceil(Math.log(cardCount) / Math.log(STACK_COUNT))
  const objective = Array.from({ length: cardCount }, (_, card) => card)

  // Choose a uniformly random target order with Fisher–Yates.

  for (let index = objective.length - 1; index > 0; index -= 1) {
    const otherIndex = randomBelow(index + 1)
    ;[objective[index], objective[otherIndex]] = [objective[otherIndex], objective[index]]
  }

  const objectivePosition = new Array<number>(cardCount)
  objective.forEach((card, position) => {
    objectivePosition[card] = position
  })

  const rounds: number[][] = []
  let current = Array.from({ length: cardCount }, (_, card) => card)
  let reverse = roundCount % 2 === 0

  // Each pass sorts by the next base-15 digit of each card's target position.
  for (let round = 0; round < roundCount; round += 1) {
    const piles = Array.from({ length: STACK_COUNT }, () => [] as number[])
    const instructions: number[] = []

    for (const card of current) {
      let pile = Math.floor(objectivePosition[card] / STACK_COUNT ** round) % STACK_COUNT
      if (reverse) pile = STACK_COUNT - 1 - pile
      instructions.push(pile)
      // Cards are placed on top; unshift models the order they'll have after restacking.
      piles[pile].unshift(card)
    }

    rounds.push(instructions)
    // The user gathers pile 1 first, so this is the next round's top-to-bottom order.
    current = piles.flat()
    reverse = !reverse
  }

  return rounds
}

function startSession(cardCount: number): void {
  if (!window.crypto?.getRandomValues) {
    statusMessage.textContent = 'Secure random numbers are not available in this browser. Open this page over HTTPS or use a modern browser.'
    return
  }

  session = {
    cardCount,
    rounds: generateRounds(cardCount),
    roundIndex: 0,
    cardIndex: 0,
    phase: 'dealing',
  }
  statusMessage.textContent = ''
  setupPanel.hidden = true
  sessionPanel.hidden = false
  setSessionView(true)
  renderSession()
}

function renderSession(): void {
  if (!session) return

  const { cardCount, rounds, roundIndex, cardIndex, phase } = session
  const roundCount = rounds.length
  const roundNumber = roundIndex + 1
  const currentPile = rounds[roundIndex][cardIndex]
  const completedCards = phase === 'dealing'
    ? roundIndex * cardCount + cardIndex
    : (roundIndex + 1) * cardCount
  const totalCards = roundCount * cardCount
  const progress = Math.round((completedCards / totalCards) * 100)

  progressTrack.setAttribute('aria-valuenow', String(progress))
  progressFill.style.width = `${progress}%`
  pileElements.forEach((pileElement, index) => {
    const active = phase === 'dealing' && index === currentPile
    pileElement.classList.toggle('active', active)
    pileElement.setAttribute('aria-label', active
      ? `Pile ${index + 1}, place card ${cardIndex + 1} here`
      : `Pile ${index + 1}`)
    const cardMarker = pileElement.querySelector<HTMLElement>('.pile-card-marker')!
    cardMarker.textContent = active ? `#${cardIndex + 1}` : ''
  })

  if (phase === 'dealing') {
    roundLabel.textContent = `ROUND ${roundNumber} OF ${roundCount}`
    sessionTitle.textContent = `Card ${cardIndex + 1} of ${cardCount}`
    instruction.innerHTML = `<span class="instruction-marker" aria-hidden="true">↓</span><span>Take the top card from your deck and place it on top of <strong>pile ${currentPile + 1}</strong>. If it's empty, this starts that pile.</span>`
    cardCounter.textContent = `${cardIndex + 1} / ${cardCount} cards this round`
    nextButton.textContent = cardIndex === cardCount - 1 ? 'Finish round →' : 'Next card →'
    undoButton.disabled = cardIndex === 0
  } else if (phase === 'round-complete') {
    roundLabel.textContent = `ROUND ${roundNumber} OF ${roundCount}`
    sessionTitle.textContent = 'Round complete'
    instruction.innerHTML = `<span class="instruction-marker" aria-hidden="true">↻</span><span>Stack the piles in order: <strong>pile 1 on top</strong>, then pile 2, continuing through pile ${STACK_COUNT}. Keep each pile in its current order.</span>`
    cardCounter.textContent = 'All cards dealt'
    nextButton.textContent = roundIndex === roundCount - 1 ? 'Finish shuffle →' : `Start round ${roundNumber + 1} →`
    undoButton.disabled = false
  } else {
    roundLabel.textContent = 'ALL ROUNDS COMPLETE'
    sessionTitle.textContent = 'Nicely shuffled.'
    instruction.innerHTML = `<span class="instruction-marker" aria-hidden="true">✓</span><span>Your deck is ready. Gather the piles in order with <strong>pile 1 on top</strong> and pile ${STACK_COUNT} at the bottom.</span>`
    cardCounter.textContent = `${cardCount} cards · ${roundCount} ${roundCount === 1 ? 'round' : 'rounds'}`
    nextButton.textContent = 'Shuffle another deck'
    undoButton.disabled = true
  }

  const isFinished = phase === 'complete'
  nextButton.disabled = false
  undoButton.hidden = isFinished
  autoButton.hidden = phase !== 'dealing'
  autoIntervalInput.disabled = phase !== 'dealing'
}

setupForm.addEventListener('submit', (event) => {
  event.preventDefault()
  if (!setupForm.reportValidity()) return

  const cardCount = cardCountInput.valueAsNumber
  if (!Number.isInteger(cardCount) || cardCount < 2 || cardCount > MAX_CARDS) return

  startSession(cardCount)
})

nextButton.addEventListener('click', () => {
  if (!session) return

  if (session.phase === 'dealing') {
    if (session.cardIndex === session.cardCount - 1) {
      stopAuto()
      session.phase = 'round-complete'
    } else {
      session.cardIndex += 1
    }
  } else if (session.phase === 'round-complete') {
    if (session.roundIndex === session.rounds.length - 1) {
      session.phase = 'complete'
    } else {
      session.roundIndex += 1
      session.cardIndex = 0
      session.phase = 'dealing'
    }
  } else {
    session = null
    setSessionView(false)
    setupPanel.hidden = false
    sessionPanel.hidden = true
    cardCountInput.focus()
    return
  }

  renderSession()
})

autoButton.addEventListener('click', () => {
  if (autoTimer !== undefined) {
    stopAuto()
  } else {
    startAuto()
  }
})

autoIntervalInput.addEventListener('change', () => {
  if (autoTimer !== undefined) startAuto()
})

undoButton.addEventListener('click', () => {
  if (!session) return

  stopAuto()
  if (session.phase === 'round-complete') {
    session.phase = 'dealing'
    session.cardIndex = session.cardCount - 1
  } else if (session.phase === 'dealing' && session.cardIndex > 0) {
    session.cardIndex -= 1
  }

  renderSession()
})

restartButton.addEventListener('click', () => {
  if (!window.confirm('Start over? Your current shuffle progress will be lost.')) return

  stopAuto()
  session = null
  setSessionView(false)
  setupPanel.hidden = false
  sessionPanel.hidden = true
  statusMessage.textContent = ''
  cardCountInput.focus()
})

renderSession()
