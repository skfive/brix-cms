'use strict';

// BF-1576 · CMS 스네이크 랭킹 관리 화면 (infra)
// 정적 화면(public/admin/snake-ranking/*)을 제공하고, backend API base URL 을
// 환경 변수(SNAKE_ADMIN_API_BASE_URL)로부터 index.html 에 주입하는 라우트.
//
// frozen UI 계약(선택자/토큰/상태)은 public/admin/snake-ranking/ 산출물에서
// 정의되며, 이 모듈은 그 파일들을 있는 그대로 제공한다. (계약 재정의 없음.)

const fs = require('node:fs');
const path = require('node:path');

const ADMIN_SNAKE_RANKING_BASE_PATH = '/admin/snake-ranking';

// index.html 안의 이 토큰이 실제 API base URL 로 치환된다.
const API_BASE_PLACEHOLDER = '__SNAKE_ADMIN_API_BASE_URL__';

const DEFAULT_PUBLIC_DIR = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'admin',
  'snake-ranking',
);

const STATIC_ASSETS = {
  'ranking.css': 'text/css; charset=utf-8',
  'ranking.js': 'application/javascript; charset=utf-8',
};

/**
 * 환경 변수에서 backend API base URL 을 해석한다.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} base URL (후행 슬래시 제거, 미설정 시 빈 문자열 = same-origin)
 */
function resolveApiBaseUrl(env) {
  const source = env || process.env;
  const raw = source.SNAKE_ADMIN_API_BASE_URL;
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  return raw.trim().replace(/\/+$/, '');
}

/**
 * 큰따옴표로 감싼 JS 문자열 리터럴 안에 안전하게 삽입되도록 이스케이프한다.
 * (따옴표/백슬래시/개행 처리 + `</script>` 브레이크아웃 무력화)
 * @param {string} value
 * @returns {string}
 */
function escapeForJsString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '')
    .replace(/</g, '\\u003c');
}

/**
 * 요청 URL 에서 쿼리스트링을 떼어낸 pathname 을 돌려준다.
 * @param {string} url
 * @returns {string}
 */
function pathnameOf(url) {
  const raw = String(url || '/');
  const qIndex = raw.indexOf('?');
  const hIndex = raw.indexOf('#');
  let end = raw.length;
  if (qIndex !== -1) end = Math.min(end, qIndex);
  if (hIndex !== -1) end = Math.min(end, hIndex);
  return raw.slice(0, end);
}

/**
 * 스네이크 랭킹 관리 화면 라우트 핸들러를 생성한다.
 * @param {{ apiBaseUrl?: string, publicDir?: string }} [options]
 * @returns {(req: {method?: string, url?: string}, res: import('node:http').ServerResponse) => boolean}
 *          경로를 처리했으면 true, 이 라우트 담당이 아니면 false.
 */
function createAdminSnakeRankingHandler(options) {
  const opts = options || {};
  const apiBaseUrl =
    typeof opts.apiBaseUrl === 'string' ? opts.apiBaseUrl : resolveApiBaseUrl();
  const publicDir = opts.publicDir || DEFAULT_PUBLIC_DIR;

  function sendText(res, statusCode, contentType, body) {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(body);
  }

  function serveIndex(res) {
    let html;
    try {
      html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    } catch (err) {
      sendText(res, 500, 'text/plain; charset=utf-8', '화면을 불러올 수 없습니다.');
      return;
    }
    const injected = html.split(API_BASE_PLACEHOLDER).join(escapeForJsString(apiBaseUrl));
    sendText(res, 200, 'text/html; charset=utf-8', injected);
  }

  function serveAsset(res, assetName) {
    const contentType = STATIC_ASSETS[assetName];
    let body;
    try {
      body = fs.readFileSync(path.join(publicDir, assetName), 'utf8');
    } catch (err) {
      sendText(res, 404, 'text/plain; charset=utf-8', 'Not Found');
      return;
    }
    sendText(res, 200, contentType, body);
  }

  return function handle(req, res) {
    const method = (req && req.method) || 'GET';
    const pathname = pathnameOf(req && req.url);

    // 이 라우트 담당 경로가 아니면 처리하지 않는다(미들웨어 체인 위임 가능).
    if (
      pathname !== ADMIN_SNAKE_RANKING_BASE_PATH &&
      !pathname.startsWith(`${ADMIN_SNAKE_RANKING_BASE_PATH}/`)
    ) {
      return false;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      sendText(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
      return true;
    }

    // /admin/snake-ranking 또는 /admin/snake-ranking/ → index
    if (
      pathname === ADMIN_SNAKE_RANKING_BASE_PATH ||
      pathname === `${ADMIN_SNAKE_RANKING_BASE_PATH}/`
    ) {
      serveIndex(res);
      return true;
    }

    const assetName = pathname.slice(ADMIN_SNAKE_RANKING_BASE_PATH.length + 1);
    if (Object.prototype.hasOwnProperty.call(STATIC_ASSETS, assetName)) {
      serveAsset(res, assetName);
      return true;
    }

    sendText(res, 404, 'text/plain; charset=utf-8', 'Not Found');
    return true;
  };
}

module.exports = {
  ADMIN_SNAKE_RANKING_BASE_PATH,
  API_BASE_PLACEHOLDER,
  resolveApiBaseUrl,
  escapeForJsString,
  createAdminSnakeRankingHandler,
};
