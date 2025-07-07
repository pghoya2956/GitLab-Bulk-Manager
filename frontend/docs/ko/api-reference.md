---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🔌 API 레퍼런스

GitLab Bulk Manager에서 사용 가능한 모든 API 엔드포인트에 대한 완전한 레퍼런스입니다.

## 🔐 인증

모든 API 요청(`/api/docs/*` 제외)은 세션 쿠키를 통한 인증이 필요합니다.

### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "gitlabUrl": "https://gitlab.com",
  "accessToken": "glpat-xxxxxxxxxxxx"
}

응답:
{
  "user": {
    "id": 123,
    "username": "john.doe",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar_url": "https://..."
  }
}
```

### 로그아웃
```http
POST /api/auth/logout

응답: 204 No Content
```

### 세션 확인
```http
GET /api/auth/session

응답:
{
  "authenticated": true,
  "user": { ... },
  "gitlabUrl": "https://gitlab.com"
}
```

## 📊 통계

### 요약 통계
```http
GET /api/stats/summary

응답:
{
  "groups": 150,
  "projects": 450,
  "users": 75,
  "timestamp": "2025-07-06T12:00:00Z"
}
```

## 🌳 GitLab 리소스

### 그룹 목록
```http
GET /api/gitlab/groups?page=1&per_page=20&search=backend

쿼리 파라미터:
- page (number): 페이지 번호
- per_page (number): 페이지당 항목 수 (최대 100)
- search (string): 검색어
- order_by (string): name | path | id
- sort (string): asc | desc

응답:
[
  {
    "id": 123,
    "name": "백엔드 팀",
    "path": "backend-team",
    "full_path": "company/backend-team",
    "visibility": "private",
    "description": "백엔드 개발팀"
  }
]

헤더:
X-Total: 150
X-Total-Pages: 8
X-Per-Page: 20
X-Page: 1
```

### 프로젝트 목록
```http
GET /api/gitlab/projects?membership=true

쿼리 파라미터:
- membership (boolean): 사용자가 멤버인 프로젝트만 표시
- archived (boolean): 아카이브된 프로젝트 포함
- visibility (string): public | internal | private
- search (string): 검색어
- order_by (string): name | path | id | created_at | updated_at
- sort (string): asc | desc

응답:
[
  {
    "id": 456,
    "name": "API 게이트웨이",
    "path": "api-gateway",
    "namespace": {
      "id": 123,
      "name": "백엔드 팀",
      "path": "backend-team",
      "full_path": "company/backend-team"
    },
    "visibility": "private",
    "archived": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

### 그룹 상세 정보
```http
GET /api/gitlab/groups/:id

응답:
{
  "id": 123,
  "name": "백엔드 팀",
  "path": "backend-team",
  "full_path": "company/backend-team",
  "visibility": "private",
  "description": "백엔드 개발팀",
  "parent_id": 100,
  "created_at": "2025-01-01T00:00:00Z",
  "projects": [],
  "shared_projects": []
}
```

### 프로젝트 상세 정보
```http
GET /api/gitlab/projects/:id

응답:
{
  "id": 456,
  "name": "API 게이트웨이",
  "path": "api-gateway",
  "description": "메인 API 게이트웨이 서비스",
  "visibility": "private",
  "namespace": { ... },
  "created_at": "2025-01-01T00:00:00Z",
  "default_branch": "main",
  "ssh_url_to_repo": "git@gitlab.com:...",
  "http_url_to_repo": "https://gitlab.com/...",
  "web_url": "https://gitlab.com/..."
}
```

## 📦 대량 작업

### 대량 가져오기
```http
POST /api/gitlab/bulk/import
Content-Type: application/json

{
  "targetGroupId": 123,
  "yaml": "groups:\n  - name: 팀 A\n    path: team-a\n    projects:\n      - name: 서비스 A\n        path: service-a"
}

응답:
{
  "jobId": "job_123456",
  "status": "pending",
  "totalItems": 5,
  "processed": 0
}
```

### 대량 설정 - 가시성
```http
PUT /api/gitlab/bulk/settings/visibility
Content-Type: application/json

{
  "items": [
    { "id": 123, "type": "group" },
    { "id": 456, "type": "project" }
  ],
  "visibility": "internal"
}

응답:
{
  "jobId": "job_789012",
  "status": "running",
  "results": []
}
```

### 대량 설정 - 보호된 브랜치
```http
PUT /api/gitlab/bulk/settings/protected-branches
Content-Type: application/json

{
  "projectIds": [456, 789],
  "settings": {
    "name": "main",
    "push_access_level": 40,
    "merge_access_level": 30,
    "unprotect_access_level": 40,
    "allow_force_push": false
  }
}

응답:
{
  "jobId": "job_345678",
  "status": "running"
}
```

### 대량 설정 - 푸시 규칙 (Premium)
```http
PUT /api/gitlab/bulk/settings/push-rules
Content-Type: application/json

{
  "projectIds": [456, 789],
  "rules": {
    "commit_message_regex": "^(feat|fix|docs|style|refactor|test|chore):",
    "branch_name_regex": "^(feature|bugfix|hotfix)/",
    "max_file_size": 100,
    "file_name_regex": "\\.(jar|exe)$",
    "denied_file_names": ["passwords.txt", "secrets.json"]
  }
}

응답:
{
  "success": true,
  "updatedCount": 2,
  "errors": []
}
```

### 대량 삭제
```http
DELETE /api/gitlab/bulk/delete
Content-Type: application/json

{
  "items": [
    { "id": 123, "type": "group" },
    { "id": 456, "type": "project" }
  ],
  "confirmDelete": true
}

응답:
{
  "jobId": "job_901234",
  "status": "running",
  "totalItems": 2
}
```

## 🔑 권한

### 권한 개요
```http
GET /api/permissions/overview

응답:
{
  "groups": [
    {
      "id": 123,
      "name": "백엔드 팀",
      "path": "backend-team",
      "full_path": "company/backend-team",
      "access_level": 50,
      "access_level_name": "Owner",
      "member_count": 25,
      "subgroups": [...],
      "projects": [...]
    }
  ],
  "summary": {
    "total_groups": 15,
    "total_projects": 45,
    "owner_count": 5,
    "maintainer_count": 10,
    "developer_count": 20,
    "reporter_count": 8,
    "guest_count": 2
  }
}
```

## 📚 문서

### 문서 가져오기
```http
GET /api/docs/:path

예제:
GET /api/docs/ko/getting-started.md

응답:
{
  "content": "# 시작하기\n\n...",
  "metadata": {
    "version": "1.0.0",
    "lastUpdated": "2025-07-06",
    "lang": "ko"
  }
}
```

## 🔄 WebSocket 이벤트

### 연결
```javascript
const socket = io('http://localhost:4000', {
  withCredentials: true
});

socket.on('connect', () => {
  console.log('WebSocket 서버에 연결됨');
});
```

### 작업 구독
```javascript
// 작업 업데이트 구독
socket.emit('subscribe', {
  type: 'job',
  jobId: 'job_123456'
});

// 업데이트 수신
socket.on('job:progress', (data) => {
  console.log('진행 상황:', data);
  // { jobId: 'job_123456', progress: 45, status: 'running' }
});

socket.on('job:complete', (data) => {
  console.log('작업 완료:', data);
  // { jobId: 'job_123456', status: 'completed', results: [...] }
});

socket.on('job:error', (data) => {
  console.error('작업 오류:', data);
  // { jobId: 'job_123456', error: '오류 메시지' }
});
```

### 그룹 업데이트
```javascript
// 그룹 변경 사항 구독
socket.emit('subscribe', {
  type: 'group',
  groupId: 123
});

socket.on('group:updated', (data) => {
  console.log('그룹 업데이트됨:', data);
});
```

## 🚨 오류 응답

### 표준 오류 형식
```json
{
  "error": "오류 메시지",
  "message": "상세한 오류 설명",
  "status": 400
}
```

### 일반적인 오류 코드
| 상태 | 설명 |
|------|------|
| 400 | 잘못된 요청 - 유효하지 않은 파라미터 |
| 401 | 인증되지 않음 - 유효한 세션 없음 |
| 403 | 금지됨 - 권한 부족 |
| 404 | 찾을 수 없음 - 리소스를 찾을 수 없음 |
| 409 | 충돌 - 리소스가 이미 존재함 |
| 422 | 처리할 수 없는 엔티티 - 검증 실패 |
| 429 | 너무 많은 요청 - 요청 제한 초과 |
| 500 | 내부 서버 오류 |
| 502 | 잘못된 게이트웨이 - GitLab API 오류 |

## 📈 요청 제한

API 요청은 남용을 방지하기 위해 제한됩니다:
- **기본**: 세션당 15분당 100개 요청
- **대량 작업**: 분당 10개 요청
- **GitLab API 프록시**: GitLab의 요청 제한 상속

요청 제한 헤더:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625140800
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [기능](./features.md) | [한국어 문서](./README.md) | [개발](./development.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/api-reference.md)**

</div>