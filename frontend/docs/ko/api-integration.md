---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🔌 API 통합 가이드

## GitLab API 개요

GitLab Bulk Manager는 GitLab REST API v4를 사용하여 GitLab 인스턴스와 통신합니다.

### 인증
모든 API 요청은 Personal Access Token을 통해 인증됩니다:
```http
Authorization: Bearer glpat-xxxxxxxxxxxx
```

### 기본 URL
```
https://gitlab.com/api/v4/
```

## 백엔드 프록시 패턴

### 왜 프록시를 사용하는가?
1. **CORS 문제 해결**: 브라우저의 동일 출처 정책 우회
2. **토큰 보안**: 토큰을 서버 사이드에만 저장
3. **요청 제어**: 속도 제한 및 재시도 로직
4. **캐싱**: 자주 사용되는 데이터 캐싱

### 프록시 구현
```typescript
// backend/src/routes/gitlab.js
router.all('/*', async (req, res) => {
  const gitlabPath = req.params[0];
  const gitlabUrl = `${req.session.gitlabUrl}/api/v4/${gitlabPath}`;
  
  try {
    const response = await axios({
      method: req.method,
      url: gitlabUrl,
      headers: {
        'Authorization': `Bearer ${req.session.gitlabToken}`,
        'Content-Type': 'application/json'
      },
      data: req.body,
      params: req.query
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'API 요청 실패'
    });
  }
});
```

## 주요 API 엔드포인트

### 그룹 관리

#### 그룹 목록 조회
```typescript
// GET /api/gitlab/groups
interface GroupListParams {
  page?: number;
  per_page?: number;
  search?: string;
  order_by?: 'name' | 'path' | 'id';
  sort?: 'asc' | 'desc';
  owned?: boolean;
  min_access_level?: number;
}

// 응답
interface Group {
  id: number;
  name: string;
  path: string;
  full_path: string;
  description: string;
  visibility: 'private' | 'internal' | 'public';
  parent_id?: number;
  avatar_url?: string;
}
```

#### 그룹 생성
```typescript
// POST /api/gitlab/groups
interface CreateGroupData {
  name: string;
  path: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
  parent_id?: number;
}
```

#### 하위 그룹 조회
```typescript
// GET /api/gitlab/groups/:id/subgroups
// 특정 그룹의 직접 하위 그룹만 반환
```

### 프로젝트 관리

#### 프로젝트 목록
```typescript
// GET /api/gitlab/projects
interface ProjectListParams {
  membership?: boolean;
  owned?: boolean;
  search?: string;
  order_by?: 'id' | 'name' | 'path' | 'created_at' | 'updated_at';
  sort?: 'asc' | 'desc';
  visibility?: 'private' | 'internal' | 'public';
}
```

#### 그룹 프로젝트 조회
```typescript
// GET /api/gitlab/groups/:id/projects
// 특정 그룹의 모든 프로젝트 (하위 그룹 포함)
```

### 멤버 관리

#### 그룹 멤버 조회
```typescript
// GET /api/gitlab/groups/:id/members/all
interface Member {
  id: number;
  username: string;
  name: string;
  state: 'active' | 'blocked';
  avatar_url: string;
  web_url: string;
  access_level: number;
  expires_at?: string;
}
```

#### 멤버 추가
```typescript
// POST /api/gitlab/groups/:id/members
interface AddMemberData {
  user_id: number;
  access_level: 10 | 20 | 30 | 40 | 50;
  expires_at?: string;
}
```

## 대량 작업 API

### 대량 가져오기
```typescript
// POST /api/gitlab/bulk/import
interface BulkImportData {
  targetGroupId?: number;
  groups?: Array<{
    name: string;
    path: string;
    description?: string;
    visibility?: string;
    parent_id?: number;
    projects?: Array<{
      name: string;
      path: string;
      description?: string;
    }>;
    subgroups?: Array</* 재귀적 구조 */>;
  }>;
}
```

### 대량 설정 변경
```typescript
// PUT /api/gitlab/bulk/settings
interface BulkSettingsData {
  items: Array<{
    id: number;
    type: 'group' | 'project';
  }>;
  settings: {
    visibility?: 'private' | 'internal' | 'public';
    protected_branches?: Array<{
      name: string;
      push_access_level: number;
      merge_access_level: number;
    }>;
    push_rules?: {
      commit_message_regex?: string;
      max_file_size?: number;
      file_name_regex?: string;
    };
  };
}
```

## 페이지네이션

### 헤더 기반 페이지네이션
```typescript
// 응답 헤더
{
  'X-Total': '100',
  'X-Total-Pages': '10',
  'X-Per-Page': '10',
  'X-Page': '1',
  'X-Next-Page': '2',
  'X-Prev-Page': '',
}

// 서비스에서 처리
const response = await axios.get(url);
const totalCount = parseInt(response.headers['x-total'] || '0');
const data = response.data;
```

## 오류 처리

### GitLab API 오류 코드
```typescript
interface GitLabError {
  message: string;
  error?: string;
  error_description?: string;
}

// 일반적인 오류 코드
- 400: 잘못된 요청
- 401: 인증 실패
- 403: 권한 없음
- 404: 리소스를 찾을 수 없음
- 409: 충돌 (예: 중복된 이름)
- 422: 처리할 수 없는 엔티티
- 429: 너무 많은 요청 (속도 제한)
- 500: 서버 오류
```

### 오류 처리 예시
```typescript
try {
  const response = await gitlabService.createGroup(data);
  return response;
} catch (error) {
  if (error.response?.status === 409) {
    throw new Error('그룹 이름이 이미 존재합니다');
  } else if (error.response?.status === 403) {
    throw new Error('이 작업을 수행할 권한이 없습니다');
  } else {
    throw new Error('그룹 생성 실패: ' + error.message);
  }
}
```

## 속도 제한

### GitLab 속도 제한
- 인증된 사용자: 분당 600 요청
- 인증되지 않은 사용자: 분당 60 요청

### 속도 제한 처리
```typescript
// 재시도 로직
async function retryWithBackoff(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## WebSocket 통합

### 실시간 업데이트
```typescript
// 클라이언트
const socket = io();

// 작업 구독
socket.emit('subscribe', { jobId });

// 진행 상황 수신
socket.on('job:progress', (data) => {
  updateProgress(data.progress);
});

// 서버
io.on('connection', (socket) => {
  socket.on('subscribe', ({ jobId }) => {
    socket.join(`job:${jobId}`);
  });
  
  // 진행 상황 전송
  io.to(`job:${jobId}`).emit('job:progress', {
    jobId,
    progress: 50,
    message: '프로젝트 생성 중...'
  });
});
```

## 권한 API

### 권한 개요 조회
```typescript
// GET /api/permissions/overview
interface PermissionOverview {
  groups: Array<{
    id: number;
    name: string;
    full_path: string;
    access_level?: number;
    member_count: number;
    projects: Array<{
      id: number;
      name: string;
      access_level?: number;
      member_count: number;
    }>;
    subgroups: Array</* 재귀적 구조 */>;
  }>;
}
```

## 모범 사례

### 1. 배치 요청
```typescript
// 여러 요청을 배치로 처리
async function batchCreateProjects(projects: Project[]) {
  const results = [];
  
  for (const batch of chunk(projects, 10)) {
    const promises = batch.map(p => createProject(p));
    const batchResults = await Promise.allSettled(promises);
    results.push(...batchResults);
    
    // 속도 제한 방지
    await delay(200);
  }
  
  return results;
}
```

### 2. 캐싱
```typescript
// React Query로 캐싱
const { data: groups } = useQuery({
  queryKey: ['groups', params],
  queryFn: () => gitlabService.getGroups(params),
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
});
```

### 3. 낙관적 업데이트
```typescript
const mutation = useMutation({
  mutationFn: updateGroup,
  onMutate: async (newGroup) => {
    // 이전 데이터 백업
    const previousGroups = queryClient.getQueryData(['groups']);
    
    // 낙관적 업데이트
    queryClient.setQueryData(['groups'], old => {
      return old.map(g => g.id === newGroup.id ? newGroup : g);
    });
    
    return { previousGroups };
  },
  onError: (err, newGroup, context) => {
    // 오류 시 롤백
    queryClient.setQueryData(['groups'], context.previousGroups);
  },
});
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [배포](./deployment.md) | [한국어 문서](./README.md) | [권한 트리](./permission-tree.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/api-integration.md)**

</div>