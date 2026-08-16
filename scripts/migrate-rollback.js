#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { pickLatestBackup } = require('../src/storage/migrate');

function resolveDataPath() {
  const target = process.argv[2] || process.env.LINKS_DATA_FILE;
  if (!target) {
    console.error(
      '[migrate:rollback] 사용법: node scripts/migrate-rollback.js <데이터파일경로> (또는 LINKS_DATA_FILE 환경변수)',
    );
    process.exit(1);
  }
  return path.resolve(target);
}

function listBackups(dataPath) {
  const dir = path.dirname(dataPath);
  const base = path.basename(dataPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.startsWith(`${base}.bak-`));
}

function main() {
  const dataPath = resolveDataPath();
  const backups = listBackups(dataPath);
  const latest = pickLatestBackup(backups);

  if (!latest) {
    console.error(`[migrate:rollback] 백업 파일을 찾을 수 없습니다: ${dataPath}.bak-*`);
    process.exit(1);
    return;
  }

  const backupPath = path.join(path.dirname(dataPath), latest);
  fs.copyFileSync(backupPath, dataPath);
  console.log(`[migrate:rollback] 원복 완료: ${backupPath} -> ${dataPath}`);
  process.exit(0);
}

main();
