import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.BROWSER_TEST_PORT || 8127)
const ROOT = new URL('../', import.meta.url)
const RESULT_TIMEOUT = 90000
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome',
  'chromium'
].filter(Boolean)
const profile = mkdtempSync(join(tmpdir(), 'mind-landscape-browser-'))
let server
let chromeSession

try {
  server = spawn(process.execPath, ['server.js', `${PORT}`, '--no-ai'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  await waitForServer()
  const chrome = await findChrome()
  chromeSession = await launchChrome(chrome)
  const compiled = []
  const errors = []
  const levels = process.env.BROWSER_TEST_LEVEL ? [process.env.BROWSER_TEST_LEVEL] : ['low', 'medium', 'high']
  for (const level of levels) {
    const result = await runHarness(`?level=${level}`)
    compiled.push(...(result.compiled || []))
    errors.push(...(result.errors || []))
  }
  const update = process.env.UPDATE_VISUAL_BASELINES === '1' ? '&update=1' : ''
  const visual = process.env.SKIP_VISUAL_REGRESSION === '1'
    ? { passed: true, errors: [], signatures: {}, comparisons: {} }
    : await runHarness(`?level=low&visual=1${update}`)
  errors.push(...(visual.errors || []))
  const lifecycle = await runHarness('', '/test/browser/lifecycle-harness.html')
  errors.push(...(lifecycle.errors || []))
  const result = {
    passed: errors.length === 0 && compiled.every(({ programs }) => programs > 0) && visual.passed && lifecycle.passed,
    compiled,
    lifecycle,
    errors,
    signatures: visual.signatures,
    comparisons: visual.comparisons
  }
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
} finally {
  await chromeSession?.close()
  server?.kill('SIGTERM')
  rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
}

async function runHarness(query, pathname = '/test/browser/render-harness.html') {
  const url = `http://127.0.0.1:${PORT}${pathname}${query}`
  await chromeSession.send('Page.navigate', { url })
  const deadline = Date.now() + RESULT_TIMEOUT
  while (Date.now() < deadline) {
    const response = await chromeSession.send('Runtime.evaluate', {
      expression: 'window.__renderTestResult || null',
      returnByValue: true
    }, Math.max(1000, deadline - Date.now()))
    const result = response.result?.result?.value
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Browser harness timed out at ${url}`)
}

async function launchChrome(chrome) {
  const child = spawn(chrome, [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-sync',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank'
  ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Chrome DevTools did not start\n${stderr}`)), 15000)
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (!match) return
      clearTimeout(timer)
      resolve(match[1])
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Chrome exited with ${code}\n${stderr}`))
    })
  })
  const address = new URL(endpoint)
  const targets = await fetch(`http://${address.host}/json/list`).then((response) => response.json())
  const target = targets.find(({ type }) => type === 'page')
  if (!target) throw new Error('Chrome created no page target')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message)
  })
  return {
    child,
    socket,
    send(method, params = {}, timeout = 15000) {
      return new Promise((resolve, reject) => {
        const id = ++sequence
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`${method} timed out after ${timeout}ms`))
        }, timeout)
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer)
            resolve(value)
          },
          reject: (error) => {
            clearTimeout(timer)
            reject(error)
          }
        })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    async close() {
      try {
        await this.send('Browser.close', {}, 2000)
      } catch {
        child.kill('SIGKILL')
      }
      socket.close()
    }
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Browser test server exited before startup')
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/status`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Browser test server did not start')
}

async function findChrome() {
  for (const path of CHROME_PATHS) {
    try {
      await run(path, ['--version'])
      return path
    } catch {}
  }
  throw new Error('Chrome or Chromium is required for browser shader tests')
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(`${command} exited with ${code}`)))
  })
}
