import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { screenshotViews } from '../test/browser/screenshot-views.js'

const PORT = Number(process.env.BROWSER_TEST_PORT || 8127)
const ROOT = new URL('../', import.meta.url)
const RESULT_TIMEOUT = Number(process.env.BROWSER_TEST_TIMEOUT || 90000)
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
  if (process.argv.includes('--performance-compare')) {
    await runHarness('', '/test/browser/screenshot-harness.html')
    const measured = await chromeSession.send('Runtime.evaluate', {
      expression: "import('/test/browser/performance-comparison.js').then(module => module.comparePerformance())",
      awaitPromise: true, returnByValue: true
    }, RESULT_TIMEOUT)
    if (measured.result?.exceptionDetails) throw new Error(JSON.stringify(measured.result.exceptionDetails))
    const result = measured.result?.result?.value
    if (!result) throw new Error(JSON.stringify(measured.result))
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--performance')) {
    await runHarness('', '/test/browser/screenshot-harness.html')
    const results = []
    for (const variant of (process.argv.includes('--current-only') ? ['current'] : ['current', 'noOutdoorWater', 'withOutdoorReflections', 'noCourtyardReflections', 'noPlasterBump'])) {
      for (const kind of ['exterior', 'courtyard', 'hallway']) {
        const measured = await chromeSession.send('Runtime.evaluate', {
          expression: `(async () => {
            const { landscape, renderer } = window.studio;
            window.performanceOriginalShader ||= landscape.mesh.material.fragmentShader;
            let shader = window.performanceOriginalShader;
            const variant = ${JSON.stringify(variant)};
            if (variant === 'noOutdoorWater') shader = shader.replace('float waterDistance = outdoorWaterDistance(origin, direction);', 'float waterDistance = -1.0;');
            if (variant === 'withOutdoorReflections') shader = shader.replace('#define ENABLE_SCENE_REFLECTIONS 0', '#define ENABLE_SCENE_REFLECTIONS 1');
            if (variant === 'noCourtyardReflections') shader = shader.replace('i < 40', 'i < 0');
            if (variant === 'noPlasterBump') shader = shader.replace('normal = courtyardPlasterNormal(position, normal, surfaceDetail)', 'normal = normal');
            if (landscape.mesh.material.fragmentShader !== shader) {
              landscape.mesh.material.fragmentShader = shader;
              landscape.mesh.material.needsUpdate = true;
            }
            const options = {kind: ${JSON.stringify(kind)}, width: 64, height: 40, phase: 3.7};
            window.renderShot(options);
            const samples = [];
            for (let i = 0; i < 3; i++) {
              const start = performance.now();
              window.renderShot(options);
              samples.push(performance.now() - start);
            }
            samples.sort((a,b) => a-b);
            const gl = renderer.getContext();
            if (gl.isContextLost()) throw new Error('WebGL context lost');
            return {variant, kind: options.kind, medianMs: samples[1], samples, errors: window.studio.errors};
          })()`, awaitPromise: true, returnByValue: true
        }, RESULT_TIMEOUT)
        if (measured.result?.exceptionDetails) throw new Error(JSON.stringify(measured.result.exceptionDetails))
        const result = measured.result?.result?.value
        if (!result || result.errors.length) throw new Error(JSON.stringify(measured.result))
        results.push(result)
        console.log(JSON.stringify(result))
        if (variant === 'current' && process.argv.includes('--capture')) {
          const capture = await chromeSession.send('Runtime.evaluate', {
            expression: `window.renderShot({kind: ${JSON.stringify(kind)}, width:320, height:208, phase:3.7}); document.querySelector('canvas').toDataURL('image/png')`, returnByValue: true
          }, RESULT_TIMEOUT)
          if (capture.result?.exceptionDetails) throw new Error(JSON.stringify(capture.result.exceptionDetails))
          writeFileSync(`/tmp/landscapes-performance-${kind}.png`, Buffer.from(capture.result.result.value.split(',')[1], 'base64'))
        }
      }
    }
    console.log(JSON.stringify({results, width:64, height:40}))
  } else if (process.argv.includes('--screenshots')) {
    await runHarness('', '/test/browser/screenshot-harness.html')
    for (const view of screenshotViews) {
      const rendered = await chromeSession.send('Runtime.evaluate', {
        expression: `window.renderShot(${JSON.stringify(view)})`, returnByValue: true
      }, RESULT_TIMEOUT)
      const result = rendered.result?.result?.value
      if (rendered.result?.exceptionDetails || !result || result.errors.length) throw new Error(JSON.stringify(rendered.result))
      const capture = await chromeSession.send('Runtime.evaluate', {
        expression: 'document.querySelector("canvas").toDataURL("image/png")', returnByValue: true
      }, RESULT_TIMEOUT)
      writeFileSync(new URL(`../screenshots/${view.name}`, import.meta.url), Buffer.from(capture.result.result.value.split(',')[1], 'base64'))
      console.log(JSON.stringify({ name: view.name, ...result }))
    }
  } else if (process.argv.includes('--visual-only')) {
    const result = await runHarness('?level=low&visual=1')
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--flowers-only')) {
    const result = await runHarness('', '/test/browser/flowers-harness.html')
    const screenshot = await chromeSession.send('Page.captureScreenshot', { format: 'png' }, 60000)
    writeFileSync('/tmp/landscape-flowers-preview.png', Buffer.from(screenshot.result.data, 'base64'))
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--water-only')) {
    const result = await runHarness('', '/test/browser/water-harness.html')
    const screenshot = await chromeSession.send('Page.captureScreenshot', { format: 'png' }, 60000)
    writeFileSync('/tmp/landscape-water-preview.png', Buffer.from(screenshot.result.data, 'base64'))
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--optimization-baseline')) {
    const result = await runHarness('?without-art', '/test/browser/optimization-harness.html')
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--art-only')) {
    const art = await runHarness('', '/test/browser/art-harness.html')
    const screenshot = await chromeSession.send('Page.captureScreenshot', { format: 'png' }, 60000)
    writeFileSync('/tmp/landscape-art-preview.png', Buffer.from(screenshot.result.data, 'base64'))
    console.log(JSON.stringify(art, null, 2))
    if (!art.passed) process.exitCode = 1
  } else if (process.argv.includes('--maze-check')) {
    const result = await runHarness('', '/test/browser/maze-harness.html')
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  } else if (process.argv.includes('--maze-only')) {
    const preview = process.argv.includes('--courtyard')
      ? `?preview&courtyard${process.argv.includes('--sky') ? '&sky' : ''}${process.argv.includes('--night') ? '&night' : ''}`
      : '?preview'
    const maze = await runHarness(preview, '/test/browser/maze-harness.html')
    const screenshot = await chromeSession.send('Page.captureScreenshot', { format: 'png' }, 60000)
    writeFileSync('/tmp/landscape-maze-preview.png', Buffer.from(screenshot.result.data, 'base64'))
    console.log(JSON.stringify({ ...maze, preview: '/tmp/landscape-maze-preview.png' }, null, 2))
    if (!maze.passed) process.exitCode = 1
  } else {
    const optimizationOnly = process.argv.includes('--optimization-only')
    const compiled = []
    const errors = []
    const levels = optimizationOnly ? [] : process.env.BROWSER_TEST_LEVEL ? [process.env.BROWSER_TEST_LEVEL] : ['low', 'medium', 'high']
    for (const level of levels) {
      const result = await runHarness(`?level=${level}`)
      compiled.push(...(result.compiled || []))
      errors.push(...(result.errors || []))
    }
    const update = process.env.UPDATE_VISUAL_BASELINES === '1' ? '&update=1' : ''
    const visual = optimizationOnly || process.env.SKIP_VISUAL_REGRESSION === '1'
      ? { passed: true, errors: [], signatures: {}, comparisons: {} }
      : await runHarness(`?level=low&visual=1${update}`)
    errors.push(...(visual.errors || []))
    const lifecycle = optimizationOnly ? { passed: true, skipped: true } : await runHarness('', '/test/browser/lifecycle-harness.html')
    errors.push(...(lifecycle.errors || []))
    const maze = await runHarness('', '/test/browser/maze-harness.html')
    errors.push(...(maze.errors || []))
    const art = await runHarness('', '/test/browser/art-harness.html')
    errors.push(...(art.errors || []))
    const water = await runHarness('', '/test/browser/water-harness.html')
    errors.push(...(water.errors || []))
    const waterPreview = await chromeSession.send('Page.captureScreenshot', { format: 'png' }, 60000)
    writeFileSync('/tmp/landscape-water-preview.png', Buffer.from(waterPreview.result.data, 'base64'))
    const optimization = await runHarness('', '/test/browser/optimization-harness.html')
    errors.push(...(optimization.errors || []))
    const result = {
      passed: errors.length === 0 && compiled.every(({ programs }) => programs > 0) && visual.passed && lifecycle.passed && optimization.passed && maze.passed && art.passed && water.passed,
      compiled,
      art,
      water,
      lifecycle,
      optimization,
      maze,
      errors,
      signatures: visual.signatures,
      comparisons: visual.comparisons
    }
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exitCode = 1
  }
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
    `--use-angle=${process.env.BROWSER_TEST_ANGLE || 'swiftshader'}`,
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
