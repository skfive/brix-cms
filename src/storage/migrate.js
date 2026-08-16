'use strict';

const { SCHEMA_VERSION, isV2, normalizeToV2 } = require('./schemaV2');

const STATES = {
  COMMITTED: 'COMMITTED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  INTEGRITY_FAILURE: 'INTEGRITY_FAILURE',
};

// 저장 파일 전체(v1/v2 혼재)를 v2로 일괄 변환한다. 순수 함수 — I/O 없음.
function migrateRecords(originalData, now) {
  const data = {};
  let migratedCount = 0;
  let skippedCount = 0;

  for (const [slug, record] of Object.entries(originalData)) {
    const alreadyV2 = isV2(record);
    let normalized;
    try {
      normalized = normalizeToV2(record, now);
    } catch (error) {
      throw new Error(`레코드 변환 실패 (slug=${slug}): ${error.message}`);
    }
    data[slug] = normalized;
    if (alreadyV2) {
      skippedCount += 1;
    } else {
      migratedCount += 1;
    }
  }

  return { data, migratedCount, skippedCount };
}

// 레코드 수 일치 · slug 유일성 · 필수 필드를 검사한다. 순수 함수 — I/O 없음.
function checkIntegrity(originalData, migratedData) {
  const errors = [];
  const originalKeys = Object.keys(originalData);
  const migratedKeys = Object.keys(migratedData);

  if (originalKeys.length !== migratedKeys.length) {
    errors.push(`레코드 수 불일치: 원본 ${originalKeys.length}건 vs 변환 ${migratedKeys.length}건`);
  }

  const seenSlugs = new Set();
  for (const key of migratedKeys) {
    const record = migratedData[key];
    if (!record || typeof record !== 'object') {
      errors.push(`레코드 형식 오류: ${key}`);
      continue;
    }
    if (record.slug !== key) {
      errors.push(`slug 필드 불일치: key=${key}, record.slug=${record.slug}`);
    } else if (seenSlugs.has(record.slug)) {
      errors.push(`slug 중복: ${record.slug}`);
    }
    seenSlugs.add(record.slug);
    if (record.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`schemaVersion 누락/불일치: ${key}`);
    }
    if (typeof record.createdAt !== 'string' || record.createdAt.length === 0) {
      errors.push(`createdAt 누락: ${key}`);
    }
    if (!Array.isArray(record.tags)) {
      errors.push(`tags 누락/형식 오류: ${key}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// 가장 최근 백업 파일명을 고른다. 타임스탬프가 고정폭 ISO 포맷이므로 사전순 정렬 = 시간순 정렬.
function pickLatestBackup(backupFileNames) {
  if (!backupFileNames || backupFileNames.length === 0) return null;
  return [...backupFileNames].sort().pop();
}

// 백업 생성 → temp 변환 → 무결성 검증 → atomic commit 순서로 진행한다.
// io 는 파일 I/O를 주입받는 어댑터(readOriginal/writeBackup/writeTemp/removeTemp/commit/restoreFromBackup).
async function runMigrateV2({ io, now }) {
  const originalRaw = await io.readOriginal();
  const originalData = originalRaw ? JSON.parse(originalRaw) : {};

  try {
    await io.writeBackup(originalRaw ?? '{}');
  } catch (error) {
    return { state: STATES.BACKUP_FAILED, error, migratedCount: 0, skippedCount: 0 };
  }

  let migrated;
  try {
    migrated = migrateRecords(originalData, now);
  } catch (error) {
    // 부분 변환 실패: 원본은 아직 안 바뀐 상태이므로 백업 복원은 확인용 재검증이다 (frozen design 3.2).
    try {
      await io.restoreFromBackup();
    } catch (rollbackError) {
      return {
        state: STATES.ROLLBACK_FAILED,
        error,
        rollbackError,
        migratedCount: 0,
        skippedCount: 0,
      };
    }
    return { state: STATES.ROLLED_BACK, error, migratedCount: 0, skippedCount: 0 };
  }

  await io.writeTemp(JSON.stringify(migrated.data, null, 2));

  const integrity = checkIntegrity(originalData, migrated.data);
  if (!integrity.ok) {
    // 원본 교체 전 temp 단계에서 검증하므로 원본은 아직 불변 — 별도 rollback 없이 temp만 폐기 (frozen design 3.3).
    await io.removeTemp();
    return {
      state: STATES.INTEGRITY_FAILURE,
      errors: integrity.errors,
      migratedCount: migrated.migratedCount,
      skippedCount: migrated.skippedCount,
    };
  }

  await io.commit();

  return {
    state: STATES.COMMITTED,
    migratedCount: migrated.migratedCount,
    skippedCount: migrated.skippedCount,
  };
}

module.exports = {
  STATES,
  migrateRecords,
  checkIntegrity,
  pickLatestBackup,
  runMigrateV2,
};
