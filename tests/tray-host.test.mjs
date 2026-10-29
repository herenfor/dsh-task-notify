import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const hostScript = fileURLToPath(new URL('../tray/dsh-tray-host.sh', import.meta.url))
// The host script runs inside WSL and relies on bash, setsid and /proc.
const linuxOnly = { skip: process.platform !== 'linux' && 'the tray host script runs on Linux (WSL)' }

// A stand-in `dsh` that prints its sign-in line and stays alive under its own command line.
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-tray-'))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'dsh'), '#!/usr/bin/env bash\necho "dsh web: http://127.0.0.1:3999/?token=FAKE"\ntrap "exit 0" TERM\nwhile :; do sleep 0.2; done\n')
  chmodSync(join(bin, 'dsh'), 0o755)
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), DSH_TRAY_PORT: '3999' }
  const run = (command) => spawnSync('bash', [hostScript, command], { env, encoding: 'utf8' })
  const pidFile = join(root, 'cache', 'dsh-tray', 'web.pid')
  return { run, pidFile }
}

const waitFor = (check) => {
  const deadline = Date.now() + 3000
  while (!check() && Date.now() < deadline) spawnSync('sleep', ['0.05'])
  return check()
}

test('start runs dsh web once, url reads its sign-in line, stop ends it', linuxOnly, () => {
  const { run, pidFile } = sandbox()
  assert.equal(run('start').status, 0)
  assert.ok(waitFor(() => existsSync(pidFile) && run('url').stdout.trim() !== ''))
  const pid = readFileSync(pidFile, 'utf8').trim()
  assert.match(readFileSync(`/proc/${pid}/cmdline`, 'utf8'), /dsh\0web\0--no-open\0--port\x003999/)
  assert.equal(run('url').stdout.trim(), 'http://127.0.0.1:3999/?token=FAKE')

  assert.equal(run('start').status, 0)  // already running: no second server
  assert.equal(readFileSync(pidFile, 'utf8').trim(), pid)

  assert.equal(run('stop').status, 0)
  assert.equal(existsSync(`/proc/${pid}`), false)
  assert.equal(existsSync(pidFile), false)
})

test('stop leaves a stale or foreign pid alone', linuxOnly, () => {
  const { run, pidFile } = sandbox()
  mkdirSync(join(pidFile, '..'), { recursive: true })
  writeFileSync(pidFile, `${process.pid}\n`)  // this test runner is not `dsh web`
  assert.equal(run('stop').status, 0)
  assert.equal(existsSync(`/proc/${process.pid}`), true)
})

test('unknown commands are rejected', linuxOnly, () => {
  assert.equal(sandbox().run('bogus').status, 2)
})
