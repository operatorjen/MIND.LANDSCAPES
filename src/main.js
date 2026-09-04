import { MindLandscape } from './mind-landscape.js'

const MIN_LOADING_DURATION = 650
const loadingStarted = performance.now()
const loadingScreen = document.querySelector('#loading-screen')
const loadingMessage = document.querySelector('#loading-message')

const preventWindowDrop = (event) => event.preventDefault()
for (const eventName of ['dragenter', 'dragover', 'drop']) window.addEventListener(eventName, preventWindowDrop, { capture: true })

const app = new MindLandscape(document.querySelector('#landscape'))
window.addEventListener('pagehide', () => {
  app.dispose()
  for (const eventName of ['dragenter', 'dragover', 'drop']) window.removeEventListener(eventName, preventWindowDrop, { capture: true })
}, { once: true })

app.start().then(revealLandscape).catch((error) => {
  console.error(error)
  const status = document.querySelector('#status')
  const message = 'The landscape could not form in this browser.'
  if (status) status.textContent = message
  if (loadingMessage) loadingMessage.textContent = message
  loadingScreen?.classList.add('failed')
  document.body.removeAttribute('aria-busy')
})

async function revealLandscape() {
  await nextFrame()
  await nextFrame()

  const remaining = MIN_LOADING_DURATION - (performance.now() - loadingStarted)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))

  loadingScreen?.classList.add('hidden')
  document.body.removeAttribute('aria-busy')
}

function nextFrame() {
  return new Promise(requestAnimationFrame)
}
