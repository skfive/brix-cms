# Reference Repos (read-only)

이 디렉터리는 다른 repo 의 main branch 를 symlink 한 **read-only** 참조 영역입니다.

## 사용 규칙
- ✅ 코드를 **읽기만** 하세요 (spec, 계약, 인터페이스 참조용).
- ❌ 절대 이 안에서 commit / 파일 수정하지 마세요. 변경은 무시되거나 다른 repo 에 누락됩니다.
- ❌ symlink 안의 git history 를 수정하지 마세요.

## Mounted
- `refs/backend/` — 다른 repo (backend) 의 main branch
