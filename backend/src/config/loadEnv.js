import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(directory, '../..')
const projectDirectory = path.resolve(backendDirectory, '..')

dotenv.config({ path: path.join(projectDirectory, '.env.local'), quiet: true })
dotenv.config({ path: path.join(backendDirectory, '.env'), quiet: true })
