'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { migrateRecords, checkIntegrity, pickLatestBackup, runMigrateV2, STATES } = require('../src/storage/migrate');

const NOW = '2026-08-16T00:00:00.000Z';
const MIGRATE_V2_SCRIPT = path.join(__dirname, '..', 'scripts', 'migrate-v2.js');
const MIGRATE_ROLLBACK_SCRIPT = path.join(__dirname, '..', 'scripts', 'migrate-rollback.js');

function createFakeIo({ initialData = {}, failBackup = false, failRestore = false } = {}) {
  const state = {
    original: JSON.stringify(initialData),
    backup: null,
    temp: null,
    committed: false,
    restored: false,
  };

  const io = {
    async readOriginal() {
      return state.original;
    },
    async writeBackup(content) {
      if (failBackup) throw new Error('디스크 공간 부족');
      state.backup = content;
    },
    async writeTemp(content) {
      state.temp = content;
    },
    async removeTemp() {
      state.temp = null;
    },
    async commit() {
      state.original = state.temp;
      state.temp = null;
      state.committed = true;
    },
    async restoreFromBackup() {
      if (failRestore) throw new Error('백업 파일 손상');
      state.original = state.backup;
      state.restored = true;
    },
  };

  return { io, state };
}

// --- migrateRecords / checkIntegrity 단위 테스트 ---

test('migrateRecords — v1은 변환, v2는 스킵하고 변환/스킵 카운트를 반환한다 (멱등)', () => {
  const originalData = {
    a: { slug: 'a', hits: 1, expiresAt: null },
    b: { slug: 'b', hits: 2, expiresAt: null, schemaVersion: 2, createdAt: '2020-01-01T00:00:00.000Z', tags: [] },
  };

  const result = migrateRecords(originalData, NOW);

  assert.equal(result.migratedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.data.a.schemaVersion, 2);
  assert.equal(result.data.a.createdAt, NOW);
  assert.equal(result.data.b.createdAt, '2020-01-01T00:00:00.000Z');
});

test('migrateRecords — 손상된 레코드가 있으면 slug 정보를 포함해 예외를 던진다', () => {
  const originalData = { broken: 'not-an-object' };

  assert.throws(() => migrateRecords(originalData, NOW), /slug=broken/);
});

test('checkIntegrity — 레코드 수가 다르면 실패한다', () => {
  const result = checkIntegrity({ a: {} }, {});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /레코드 수 불일치/);
});

test('checkIntegrity — slug 필드가 key와 다르면 실패한다', () => {
  const migrated = { abc: { slug: 'xyz', hits: 0, schemaVersion: 2, createdAt: NOW, tags: [] } };
  const result = checkIntegrity({ abc: {} }, migrated);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /slug 필드 불일치/);
});

test('checkIntegrity — 필수 필드(schemaVersion/createdAt/tags)가 없으면 실패한다', () => {
  const migrated = { a: { slug: 'a' } };
  const result = checkIntegrity({ a: {} }, migrated);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schemaVersion/);
  assert.match(result.errors.join('\n'), /createdAt/);
  assert.match(result.errors.join('\n'), /tags/);
});

test('checkIntegrity — 정상 변환 결과는 통과한다', () => {
  const migrated = { a: { slug: 'a', hits: 0, schemaVersion: 2, createdAt: NOW, tags: [] } };
  const result = checkIntegrity({ a: {} }, migrated);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

// --- pickLatestBackup 단위 테스트 ---

test('pickLatestBackup — 백업이 없으면 null을 반환한다', () => {
  assert.equal(pickLatestBackup([]), null);
  assert.equal(pickLatestBackup(undefined), null);
});

test('pickLatestBackup — 타임스탬프 사전순 정렬로 가장 최근 백업을 고른다', () => {
  const files = [
    'links.json.bak-2026-08-16T00-00-00-000Z',
    'links.json.bak-2026-08-16T02-00-00-000Z',
    'links.json.bak-2026-08-15T23-00-00-000Z',
  ];
  assert.equal(pickLatestBackup(files), 'links.json.bak-2026-08-16T02-00-00-000Z');
});

// --- runMigrateV2 오케스트레이션: 상태 전이 시나리오 ---

test('runMigrateV2 — 성공 시 COMMITTED 상태와 요약 카운트를 반환한다', async () => {
  const { io, state } = createFakeIo({
    initialData: { a: { slug: 'a', hits: 1, expiresAt: null } },
  });

  const result = await runMigrateV2({ io, now: NOW });

  assert.equal(result.state, STATES.COMMITTED);
  assert.equal(result.migratedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(state.committed, true);
  assert.deepEqual(JSON.parse(state.original).a.schemaVersion, 2);
});

test('runMigrateV2 — 백업 생성 실패 시 BACKUP_FAILED, 원본 불변, 롤백 시도 없음', async () => {
  const rawOriginal = JSON.stringify({ a: { slug: 'a', hits: 1 } });
  const { io, state } = createFakeIo({ initialData: JSON.parse(rawOriginal), failBackup: true });

  const result = await runMigrateV2({ io, now: NOW });

  assert.equal(result.state, STATES.BACKUP_FAILED);
  assert.equal(state.committed, false);
  assert.equal(state.restored, false);
  assert.equal(state.original, rawOriginal);
});

test('runMigrateV2 — 부분 변환 실패 시 자동 롤백되어 ROLLED_BACK, 원본 불변', async () => {
  const rawOriginal = JSON.stringify({ broken: 'not-an-object' });
  const { io, state } = createFakeIo({ initialData: JSON.parse(rawOriginal) });

  const result = await runMigrateV2({ io, now: NOW });

  assert.equal(result.state, STATES.ROLLED_BACK);
  assert.equal(state.restored, true);
  assert.equal(state.committed, false);
  assert.equal(state.original, rawOriginal);
});

test('runMigrateV2 — 부분 변환 실패 + 롤백 자체 실패 시 ROLLBACK_FAILED', async () => {
  const { io } = createFakeIo({ initialData: { broken: 'not-an-object' }, failRestore: true });

  const result = await runMigrateV2({ io, now: NOW });

  assert.equal(result.state, STATES.ROLLBACK_FAILED);
  assert.ok(result.error);
  assert.ok(result.rollbackError);
});

test('runMigrateV2 — 무결성 검증 실패 시 INTEGRITY_FAILURE, temp 폐기, 원본 불변 (별도 롤백 없이도 원본 불변)', async () => {
  // record.slug가 key와 다른 손상된 데이터 — checkIntegrity에서 잡힘
  const rawOriginal = JSON.stringify({ abc: { slug: 'mismatched', hits: 0 } });
  const { io, state } = createFakeIo({ initialData: JSON.parse(rawOriginal) });

  const result = await runMigrateV2({ io, now: NOW });

  assert.equal(result.state, STATES.INTEGRITY_FAILURE);
  assert.ok(result.errors.length > 0);
  assert.equal(state.temp, null);
  assert.equal(state.committed, false);
  assert.equal(state.original, rawOriginal);
});

// --- CLI 실제 실행 (child_process) — npm run migrate:v2 / migrate:rollback 동일 경로 ---

function withTempFixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf2149-'));
  const dataPath = path.join(dir, 'links.json');
  try {
    return fn(dataPath, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(scriptPath, args) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: error.stdout, stderr: error.stderr };
  }
}

test('CLI migrate-v2 — 실제 파일을 백업 후 v2로 일괄 변환하고 exit 0', () => {
  withTempFixture((dataPath) => {
    const v1Data = { a: { slug: 'a', hits: 1, expiresAt: null } };
    fs.writeFileSync(dataPath, JSON.stringify(v1Data, null, 2));

    const result = runCli(MIGRATE_V2_SCRIPT, [dataPath]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /변환 1건, 스킵\(이미 v2\) 0건/);

    const migrated = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    assert.equal(migrated.a.schemaVersion, 2);
    assert.deepEqual(migrated.a.tags, []);

    const backupFiles = fs.readdirSync(path.dirname(dataPath)).filter((f) => f.includes('.bak-'));
    assert.equal(backupFiles.length, 1);
    const backedUp = JSON.parse(fs.readFileSync(path.join(path.dirname(dataPath), backupFiles[0]), 'utf8'));
    assert.deepEqual(backedUp, v1Data);
  });
});

test('CLI migrate-v2 — 이미 v2인 파일에 재실행하면 전부 스킵(멱등)', () => {
  withTempFixture((dataPath) => {
    fs.writeFileSync(dataPath, JSON.stringify({ a: { slug: 'a', hits: 1, expiresAt: null } }, null, 2));

    runCli(MIGRATE_V2_SCRIPT, [dataPath]);
    const second = runCli(MIGRATE_V2_SCRIPT, [dataPath]);

    assert.equal(second.code, 0);
    assert.match(second.stdout, /변환 0건, 스킵\(이미 v2\) 1건/);
  });
});

test('CLI migrate-v2 — 경로 인자가 없으면 사용법 오류와 함께 exit 비0', () => {
  const result = runCli(MIGRATE_V2_SCRIPT, []);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /사용법/);
});

test('CLI migrate-rollback — 최신 백업으로 원복하고 exit 0', () => {
  withTempFixture((dataPath) => {
    const v1Data = { a: { slug: 'a', hits: 1, expiresAt: null } };
    fs.writeFileSync(dataPath, JSON.stringify(v1Data, null, 2));

    runCli(MIGRATE_V2_SCRIPT, [dataPath]);
    const migratedBeforeRollback = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    assert.equal(migratedBeforeRollback.a.schemaVersion, 2);

    const rollbackResult = runCli(MIGRATE_ROLLBACK_SCRIPT, [dataPath]);

    assert.equal(rollbackResult.code, 0);
    assert.match(rollbackResult.stdout, /원복 완료/);
    const restored = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    assert.deepEqual(restored, v1Data);
  });
});

test('CLI migrate-rollback — 백업이 없으면 명확한 오류와 함께 exit 비0', () => {
  withTempFixture((dataPath) => {
    fs.writeFileSync(dataPath, JSON.stringify({ a: { slug: 'a', hits: 1 } }, null, 2));

    const result = runCli(MIGRATE_ROLLBACK_SCRIPT, [dataPath]);

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /백업 파일을 찾을 수 없습니다/);
  });
});
