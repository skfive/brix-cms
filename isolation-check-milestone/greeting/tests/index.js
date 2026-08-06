'use strict';

// node --test 가 tests/ 디렉토리를 대상으로 실행될 때(Node 22 는 디렉토리를
// CommonJS 엔트리로 해석) 회귀 테스트가 로드되도록 하는 부트스트랩이다.
// 실제 테스트는 greeting.test.js 에 있으며, 이 파일은 그것을 등록만 한다.
require('./greeting.test.js');
