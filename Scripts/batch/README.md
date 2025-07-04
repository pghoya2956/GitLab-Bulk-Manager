# GitLab Batch Operations

이 디렉토리는 GitLab의 대량 작업을 위한 스크립트들을 포함합니다.

## 주요 스크립트

### create_subgroups_bulk.sh
Parent ID 기반으로 계층적 서브그룹을 대량 생성합니다.

```bash
# YAML 설정으로 서브그룹 생성
./create_subgroups_bulk.sh --config subgroups.yaml

# 미리보기 모드
./create_subgroups_bulk.sh --config subgroups.yaml --dry-run
```

### create_projects_bulk.sh
여러 그룹에 프로젝트를 대량 생성하고 브랜치 보호, CI/CD 변수를 설정합니다.

```bash
# YAML 설정으로 프로젝트 생성
./create_projects_bulk.sh --config projects-bulk.yaml

# API 호출 속도 조절
./create_projects_bulk.sh --config projects-bulk.yaml --api-delay 500
```

## YAML 설정 형식

### subgroups.yaml
```yaml
parent_id: 123  # 부모 그룹 ID (필수)

defaults:
  visibility: private
  request_access_enabled: true

subgroups:
  - name: "개발팀"
    path: "dev-team"
    description: "개발 조직"
    subgroups:  # 중첩 가능
      - name: "프론트엔드"
        path: "frontend"
```

### projects-bulk.yaml
```yaml
defaults:
  visibility: private
  default_branch: main

projects:
  - group_id: 110  # 그룹 ID (필수)
    projects:
      - name: "web-app"
        description: "웹 애플리케이션"
        topics: ["frontend", "react"]
        settings:
          pages_enabled: true

branch_protection:
  default:
    branch: main
    push_access_level: developer
    merge_access_level: maintainer

ci_variables:
  global:
    - key: "ENVIRONMENT"
      value: "production"
      protected: true
```

## 주요 기능

### 멱등성 (Idempotency)
- 이미 존재하는 리소스는 건너뜁니다
- 스크립트를 여러 번 실행해도 안전합니다

### Rate Limiting
- GitLab API 제한 자동 처리
- 429 오류 시 자동 대기
- 헤더 기반 제한 추적

### 오류 처리
- 지수 백오프로 재시도
- 5xx 서버 오류 자동 재시도
- 실패 시에도 계속 진행 옵션

### Dry Run 모드
- 실제 변경 없이 미리보기
- 생성될 리소스 확인
- 설정 검증

## 성능 고려사항

### 대규모 작업 시
- `--api-delay` 옵션으로 속도 조절
- `--parallel` 옵션으로 병렬 처리 (projects)
- 배치 크기 조절 가능

### 권장사항
- 100개 이하: 기본 설정 사용
- 100-1000개: API delay 200-500ms
- 1000개 이상: 여러 번 나누어 실행

## 문제 해결

### YAML 파서 오류
```bash
# yq 설치 (권장)
brew install yq

# 또는 Python PyYAML 사용
pip3 install pyyaml
```

### Rate Limit 오류
- API delay 증가: `--api-delay 1000`
- 작업을 여러 시간대에 분산

### 권한 오류
- GitLab 토큰 스코프 확인 (api, write_repository)
- 부모 그룹에 대한 Owner/Maintainer 권한 필요