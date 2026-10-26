#!/usr/bin/env node
// Resume (ou compara) arquivos de medição gravados com --perf-log.
//   node scripts/perf-report.mjs <perf.jsonl>
//   node scripts/perf-report.mjs <antes.jsonl> <depois.jsonl>
import { readFileSync } from 'node:fs'
import { formatReport, summarize } from './lib/perfReport.mjs'

const [first, second] = process.argv.slice(2)
if (!first) {
  console.error('uso: node scripts/perf-report.mjs <antes.jsonl> [depois.jsonl]')
  process.exit(2)
}

const load = (path) => summarize(readFileSync(path, 'utf8'))
console.log(formatReport(load(first), second ? load(second) : null))
