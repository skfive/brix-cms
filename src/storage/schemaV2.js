'use strict';

const SCHEMA_VERSION = 2;

function isV2(record) {
  return (
    record !== null &&
    typeof record === 'object' &&
    Object.prototype.hasOwnProperty.call(record, 'schemaVersion')
  );
}

// now: ISO 8601 string, injected by the caller so this stays a pure function.
function normalizeToV2(record, now) {
  if (record === null || record === undefined) {
    return record;
  }
  if (typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`손상된 레코드: 객체가 아님 (${JSON.stringify(record)})`);
  }
  if (isV2(record)) {
    return { ...record };
  }
  return {
    ...record,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    tags: [],
  };
}

module.exports = { SCHEMA_VERSION, isV2, normalizeToV2 };
