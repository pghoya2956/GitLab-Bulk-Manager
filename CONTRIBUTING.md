# 🤝 Contributing to GitLab Bulk Manager

간단하고 실용적인 기여 가이드입니다.

## 🚀 시작하기

```bash
# 1. Fork & Clone
git clone https://github.com/your-username/gitlab-bulk-manager.git
cd gitlab-bulk-manager

# 2. 의존성 설치
npm install

# 3. 환경 설정
cp .env.example .env
# .env 파일에 GitLab 토큰 설정

# 4. 개발 서버 실행
./manage.sh start
```

## 📁 프로젝트 구조

```
frontend/          # React 애플리케이션
├── src/
│   ├── components/  # UI 컴포넌트
│   ├── pages/      # 페이지 컴포넌트
│   └── services/   # API 서비스
backend/           # Express 프록시 서버
└── src/
    └── routes/    # API 라우트
```

## 💻 개발 가이드

### TypeScript 스타일
```typescript
// ✅ Good: 명시적 타입 선언
const processNode = (node: IGitLabNode): string => {
  return node.name.toUpperCase();
};

// ✅ Good: 옵셔널 체이닝
const name = node?.metadata?.name ?? 'Unknown';
```

### React 컴포넌트
```typescript
interface Props {
  node: IGitLabNode;
  onSelect?: (id: string) => void;
}

export const Component: React.FC<Props> = ({ node, onSelect }) => {
  // 함수형 컴포넌트 + hooks 사용
};
```

## 🔄 Git 워크플로우

### 1. 브랜치 생성
```bash
git checkout -b feature/description
# 또는
git checkout -b fix/issue-number
```

### 2. 커밋 메시지
```
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 개선
docs: 문서 업데이트
test: 테스트 추가
```

### 3. PR 체크리스트
- [ ] 테스트 통과
- [ ] 린트 에러 없음
- [ ] 명확한 설명 작성
- [ ] 스크린샷 첨부 (UI 변경 시)
- [ ] 문서 업데이트 (새 기능/컴포넌트 추가 시)

## 📚 문서화

새로운 기능이나 컴포넌트를 추가할 때:
1. 관련 문서 파일 업데이트 (`frontend/docs/`)
2. 코드 예제 포함
3. [문서 감사 체크리스트](frontend/docs/DOCUMENTATION_AUDIT.md) 업데이트

## 🧪 테스트

```bash
# 프론트엔드 테스트
cd frontend && npm test

# E2E 테스트
npx playwright test

# 린트 체크
npm run lint
```

## 🐛 이슈 리포트

### 버그 리포트
```markdown
**문제 설명**
명확한 버그 설명

**재현 방법**
1. '...' 페이지 이동
2. '...' 클릭
3. 에러 발생

**예상 동작**
어떻게 동작해야 하는지

**환경**
- OS: [예: macOS]
- 브라우저: [예: Chrome]
```

## 📚 유용한 링크

- [React 문서](https://react.dev)
- [Material-UI](https://mui.com)
- [GitLab API](https://docs.gitlab.com/ee/api/)

## 💬 도움이 필요하다면

- GitHub Issues에서 질문하기
- 기존 이슈 확인하기
- PR에 코멘트 남기기

감사합니다! 🎉