#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runMigrateV2, STATES } = require('../src/storage/migrate');

function resolveDataPath() {
  const target = process.argv[2] || process.env.LINKS_DATA_FILE;
  if (!target) {
    console.error(
      '[migrate:v2] 사용법: node scripts/migrate-v2.js <데이터파일경로> (또는 LINKS_DATA_FILE 환경변수)',
    );
    process.exit(1);
  }
  return path.resolve(target);
}

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createFsIo(dataPath) {
  const backupPath = `${dataPath}.bak-${timestampSuffix()}`;
  const tempPath = `${dataPath}.tmp`;

  const io = {
    async readOriginal() {
      if (!fs.existsSync(dataPath)) return null;
      return fs.readFileSync(dataPath, 'utf8');
    },
    async writeBackup(content) {
      fs.writeFileSync(backupPath, content);
    },
    async writeTemp(content) {
      fs.writeFileSync(tempPath, content);
    },
    async removeTemp() {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    },
    async commit() {
      fs.renameSync(tempPath, dataPath);
    },
    async restoreFromBackup() {
      fs.copyFileSync(backupPath, dataPath);
    },
  };

  return { io, backupPath };
}

async function main() {
  const dataPath = resolveDataPath();
  const now = new Date().toISOString();
  const { io, backupPath } = createFsIo(dataPath);

  const result = await runMigrateV2({ io, now });

  switch (result.state) {
    case STATES.COMMITTED:
      console.log(
        `[migrate:v2] 변환 완료 — 변환 ${result.migratedCount}건, 스킵(이미 v2) ${result.skippedCount}건`,
      );
      console.log(`[migrate:v2] 백업: ${backupPath}`);
      process.exit(0);
      break;
    case STATES.BACKUP_FAILED:
      console.error(`[migrate:v2] 백업 생성 실패 — 원본은 변경되지 않았습니다: ${result.error.message}`);
      process.exit(1);
      break;
    case STATES.ROLLED_BACK:
      console.error(`[migrate:v2] 변환 중 오류 발생 — 백업으로 원복 완료: ${result.error.message}`);
      process.exit(1);
      break;
    case STATES.ROLLBACK_FAILED:
      console.error(`[migrate:v2] 변환 중 오류 발생 + 롤백도 실패 — 수동 개입 필요.`);
      console.error(`  원인: ${result.error.message}`);
      console.error(`  롤백 오류: ${result.rollbackError.message}`);
      console.error(`  백업 파일: ${backupPath}`);
      process.exit(1);
      break;
    case STATES.INTEGRITY_FAILURE:
      console.error('[migrate:v2] 무결성 검증 실패 — 원본은 변경되지 않았습니다:');
      result.errors.forEach((message) => console.error(`  - ${message}`));
      process.exit(1);
      break;
    default:
      console.error(`[migrate:v2] 알 수 없는 상태: ${result.state}`);
      process.exit(1);
  }
}

main();
