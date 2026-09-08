import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
const PORT=8139
const ROOT=new URL('../',import.meta.url)
const CHROME_PATHS=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
const profile=mkdtempSync(join(tmpdir(),'landscape-studio-'))
const server=spawn(process.execPath,['server.js',String(PORT),'--no-ai'],{cwd:ROOT,stdio:'ignore'})
let session
try {
 await waitForServer()
 session=await launchChrome(await findChrome())
 await session.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/test/browser/screenshot-harness.html`})
 let previous=''
 while(true){
  if(existsSync('/tmp/landscape-shot-request.json')) {
   const raw=readFileSync('/tmp/landscape-shot-request.json','utf8')
   if(raw!==previous){
    previous=raw
    const request=JSON.parse(raw)
    try {
     const r=await session.send('Runtime.evaluate',{expression:request.expression || `window.renderShot(${JSON.stringify(request.options||{})})`,returnByValue:true},180000)
     if(request.path){
      const img=await session.send('Runtime.evaluate',{expression:'document.querySelector("canvas").toDataURL("image/png")',returnByValue:true},60000)
      writeFileSync(request.path,Buffer.from(img.result.result.value.split(',')[1],'base64'))
     }
     writeFileSync('/tmp/landscape-shot-result.json',JSON.stringify(r))
     console.log(JSON.stringify(r))
    }catch(e){console.log(e.message)}
   }
  }
  await new Promise(r=>setTimeout(r,300))
 }
} finally { await session?.close(); server.kill(); rmSync(profile,{recursive:true,force:true}) }
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
    '--use-angle=metal',
    
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
