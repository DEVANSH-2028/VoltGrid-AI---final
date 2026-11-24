import dotenv from 'dotenv'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = path.resolve(backendDirectory, '..')
const cliCandidates = [
  path.join(projectDirectory, 'node_modules', 'prisma', 'build', 'index.js'),
  path.join(backendDirectory, 'node_modules', 'prisma', 'build', 'index.js'),
]

dotenv.config({ path: path.join(projectDirectory, '.env.local'), quiet: true })
dotenv.config({ path: path.join(backendDirectory, '.env'), quiet: true })

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_UNPOOLED) {
  throw new Error('Set both DATABASE_URL and DATABASE_URL_UNPOOLED before running Prisma migrations.')
}

const prismaCli = cliCandidates.find(candidate => existsSync(candidate))
if (!prismaCli) throw new Error('Prisma CLI is not installed. Run npm ci first.')

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: backendDirectory,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
