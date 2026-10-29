import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// A fresh SQLite database for each test file.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'shopfront-test-'))
