---
version: 1.0.0
lastUpdated: 2025-07-06
status: complete
lang: ko
---

# 🧩 컴포넌트 문서

## 핵심 컴포넌트

### GitLabTree

GitLab 그룹과 프로젝트를 표시하는 계층적 트리 뷰 컴포넌트입니다.

#### Props
```typescript
interface GitLabTreeProps {
  onSelect: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode) => void;
  onDrop?: (targetNode: TreeNode, draggedNode: TreeNode) => void;
  selectedNodeId?: string;
}
```

#### 기능
- 자식 노드의 지연 로딩
- 드래그 앤 드롭 지원
- 검색 기능
- 작업에 대한 시각적 피드백

#### 사용법
```tsx
<GitLabTree
  onSelect={handleNodeSelect}
  onDrop={handleDragDrop}
  selectedNodeId={selectedNode?.id}
/>
```

### Layout

네비게이션 헤더가 있는 메인 애플리케이션 레이아웃입니다.

#### 기능
- 반응형 네비게이션 바
- 로그아웃이 포함된 사용자 메뉴
- 활성 경로 하이라이트
- 빵부스러기(Breadcrumb) 지원

#### 구조
```tsx
<Layout>
  <AppBar />
  <Container>
    <Outlet /> {/* 페이지 콘텐츠 */}
  </Container>
</Layout>
```

### PermissionTree

모든 GitLab 그룹과 프로젝트에 걸친 사용자 접근 레벨을 표시하는 포괄적인 권한 시각화 컴포넌트입니다.

#### 기능
- 권한의 계층적 트리 뷰
- 색상으로 구분된 접근 레벨 배지
- 자동 확장 검색 기능
- 멤버 수 표시기
- 가시성 아이콘

#### 사용법
```tsx
<PermissionTree />
```

#### 접근 레벨 색상
- Owner: `#ff6b6b` (빨간색)
- Maintainer: `#4dabf7` (파란색)
- Developer: `#51cf66` (녹색)
- Reporter: `#868e96` (회색)
- Guest: `#adb5bd` (연한 회색)

자세한 정보는 [권한 트리 문서](./permission-tree.md)를 참조하세요.

## 대량 작업 컴포넌트

### ImportGroups

CSV 파일에서 그룹을 대량으로 가져옵니다.

#### Props
```typescript
interface ImportGroupsProps {
  selectedGroup?: {
    id: number;
    name: string;
    full_path: string;
  };
}
```

#### CSV 형식
```csv
name|path|parent_id|description|visibility
Frontend Team|frontend||Frontend development team|private
```

#### 기능
- 드래그 앤 드롭 파일 업로드
- 진행 상황 추적
- 행별 오류 처리
- 컨텍스트 인식 부모 그룹 선택

### ImportProjects

CSV 파일에서 대량 프로젝트 생성.

#### CSV 형식
```csv
name|group_id|description|visibility|issues_enabled|wiki_enabled|default_branch
web-app|123|Main application|private|true|true|main
```

#### 기능
- 자동 네임스페이스 할당
- 프로젝트 구성 옵션
- 진행 상황과 함께 배치 처리

### ImportMembers

그룹에 여러 멤버를 추가합니다.

#### CSV 형식
```csv
email|group_path|access_level|expiry_date
user@example.com|dev-team|developer|2024-12-31
```

#### 접근 레벨
- `guest` (10)
- `reporter` (20)
- `developer` (30)
- `maintainer` (40)
- `owner` (50)

## 공통 컴포넌트

### LoadingSpinner

앱 전체에서 일관된 로딩 표시기.

```tsx
<LoadingSpinner size="large" message="그룹 로딩 중..." />
```

### ConfirmDialog

파괴적인 작업을 위한 재사용 가능한 확인 다이얼로그.

```tsx
<ConfirmDialog
  open={open}
  title="그룹 삭제"
  message="이 그룹을 삭제하시겠습니까?"
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

### ErrorAlert

재시도 옵션과 함께 오류 메시지를 표시합니다.

```tsx
<ErrorAlert
  error="데이터 로드 실패"
  onRetry={handleRetry}
  onDismiss={() => setError(null)}
/>
```

## 폼 컴포넌트

### GroupForm

그룹 생성/편집을 위한 폼.

#### 필드
- 이름 (필수)
- 경로 (이름에서 자동 생성)
- 설명
- 가시성 레벨
- 부모 그룹 (선택사항)

### ProjectForm

프로젝트 생성을 위한 폼.

#### 필드
- 이름 (필수)
- 네임스페이스 (그룹 선택)
- 설명
- 가시성
- README로 초기화
- 기본 브랜치

## 테이블 컴포넌트

### GroupTable

정렬 및 필터링 가능한 테이블에 그룹을 표시합니다.

#### 기능
- 열 정렬
- 페이지네이션
- 행 선택
- 행별 액션 버튼
- 대량 액션

### ProjectTable

프로젝트를 위한 GroupTable과 유사한 기능.

#### 추가 기능
- 상태 표시기
- GitLab 빠른 링크
- 클론 URL 복사 버튼

## 다이얼로그 컴포넌트

### CreateGroupDialog

새 그룹 생성을 위한 모달.

```tsx
<CreateGroupDialog
  open={open}
  parentGroup={selectedGroup}
  onClose={() => setOpen(false)}
  onSuccess={handleGroupCreated}
/>
```

### EditProjectDialog

프로젝트 설정 편집을 위한 모달.

```tsx
<EditProjectDialog
  open={open}
  project={selectedProject}
  onClose={() => setOpen(false)}
  onSuccess={handleProjectUpdated}
/>
```

## 네비게이션 컴포넌트

### Breadcrumbs

계층 구조에서 현재 위치를 표시합니다.

```tsx
<Breadcrumbs>
  <Link to="/groups">그룹</Link>
  <Link to="/groups/123">부모 그룹</Link>
  <Typography>현재 그룹</Typography>
</Breadcrumbs>
```

### TabNavigation

관련 뷰 간 전환을 위한 탭.

```tsx
<TabNavigation
  tabs={[
    { label: '그룹', value: 'groups' },
    { label: '프로젝트', value: 'projects' },
    { label: '멤버', value: 'members' }
  ]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

## 유틸리티 컴포넌트

### CopyButton

피드백과 함께 텍스트를 클립보드에 복사.

```tsx
<CopyButton text="https://gitlab.com/group/project.git" />
```

### StatusChip

시각적 상태 표시기.

```tsx
<StatusChip status="success" label="활성" />
<StatusChip status="error" label="실패" />
<StatusChip status="warning" label="대기 중" />
```

### VisibilityIcon

GitLab 가시성 레벨을 위한 아이콘.

```tsx
<VisibilityIcon level="private" /> // 자물쇠 아이콘
<VisibilityIcon level="internal" /> // 방패 아이콘
<VisibilityIcon level="public" /> // 지구본 아이콘
```

## 컴포넌트 모범 사례

### Props 인터페이스
항상 props에 대한 TypeScript 인터페이스를 정의하세요:
```typescript
interface ComponentProps {
  required: string;
  optional?: number;
  callback: (value: string) => void;
}
```

### 기본 Props
선택적 props에 대해 기본 매개변수를 사용하세요:
```typescript
const Component: React.FC<ComponentProps> = ({
  required,
  optional = 42,
  callback
}) => {
  // 컴포넌트 로직
};
```

### 메모이제이션
비용이 많이 드는 컴포넌트에는 React.memo를 사용하세요:
```typescript
export const ExpensiveComponent = React.memo(Component, (prev, next) => {
  return prev.data.id === next.data.id;
});
```

### 에러 바운더리
기능 컴포넌트를 에러 바운더리로 감싸세요:
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <FeatureComponent />
</ErrorBoundary>
```

## 🔄 빠른 네비게이션

<div align="center">

| ← 이전 | 홈 | 다음 → |
|--------|-----|--------|
| [기능](./features.md) | [한국어 문서](./README.md) | [API 통합](./api-integration.md) |

</div>

---

<div align="center">

**[🇺🇸 View English Version](../en/components.md)**

</div>