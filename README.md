# GitLab 관리 스크립트

GitLab 인스턴스의 그룹, 프로젝트, 사용자 관리를 자동화하는 스크립트 모음입니다.

## 목차

- [설치](#설치)
- [설정](#설정)
- [스크립트 사용법](#스크립트-사용법)
  - [그룹 관리](#그룹-관리)
  - [프로젝트 관리](#프로젝트-관리)
  - [백업](#백업)
- [디렉토리 구조](#디렉토리-구조)
- [팁과 모범 사례](#팁과-모범-사례)

## 설치

```bash
# 저장소 클론
git clone <repository-url>
cd GitLab

# 실행 권한 부여
find Scripts -name "*.sh" -type f -exec chmod +x {} \;
```

## 설정

### 1. GitLab API 토큰 설정

```bash
# 설정 파일 복사
cp Scripts/config/gitlab.env.example Scripts/config/gitlab.env

# 편집기로 열어 GitLab URL과 API 토큰 설정
# GITLAB_URL=https://gitlab.example.com
# GITLAB_TOKEN=glpat-xxxxxxxxxxxxx
```

API 토큰은 GitLab의 User Settings > Access Tokens에서 생성할 수 있습니다.
필요한 권한: `api`, `read_api`, `read_repository`, `write_repository`

## 스크립트 사용법

### 그룹 관리

#### 그룹 생성
```bash
# 단일 그룹 생성
./Scripts/groups/create_groups.sh --name "개발팀" --description "개발팀 그룹"

# 서브그룹 생성
./Scripts/groups/create_groups.sh --name "백엔드" --parent_id 123 --visibility internal

# 파일에서 여러 그룹 생성
./Scripts/groups/create_groups.sh --from-file groups.txt
```

#### 그룹 목록 조회
```bash
# 모든 그룹 목록
./Scripts/groups/list_groups.sh

# 검색 및 필터링
./Scripts/groups/list_groups.sh --search "dev" --min-access maintainer

# CSV 형식으로 출력
./Scripts/groups/list_groups.sh --format csv > groups.csv
```

#### 그룹 설정 변경
```bash
# 가시성 변경
./Scripts/groups/update_group_settings.sh --id 123 --visibility private

# 여러 설정 동시 변경
./Scripts/groups/update_group_settings.sh --id 123 \
  --name "새이름" \
  --description "새로운 설명" \
  --project-creation 2
```

#### 그룹 삭제
```bash
# 확인 후 삭제
./Scripts/groups/delete_groups.sh --id 123

# 하위 그룹 포함 강제 삭제
./Scripts/groups/delete_groups.sh --id 123 --include-subgroups --force
```

### 프로젝트 관리

#### 프로젝트 생성
```bash
# 단일 프로젝트 생성
./Scripts/projects/create_gitlab_projects.sh --group_id 123

# projects.txt 파일에서 일괄 생성
./Scripts/projects/create_gitlab_projects.sh --group_id 123
```

#### 프로젝트 클론
```bash
# 그룹의 모든 프로젝트 클론
./Scripts/projects/clone_all_projects.sh --group-id 123

# HTTPS로 특정 디렉토리에 클론
./Scripts/projects/clone_all_projects.sh --group-id 123 \
  --clone-type https \
  --output-dir /backup/gitlab

# 병렬 처리로 빠르게 클론
./Scripts/projects/clone_all_projects.sh --group-id 123 --parallel 10
```

#### 프로젝트 삭제
```bash
# 단일 프로젝트 삭제
./Scripts/projects/delete_projects.sh --id 456

# 그룹의 모든 프로젝트 삭제
./Scripts/projects/delete_projects.sh --group-id 123 --force

# 파일에서 여러 프로젝트 삭제
./Scripts/projects/delete_projects.sh --from-file projects-to-delete.txt
```

### 백업

#### 프로젝트 백업
```bash
# 그룹 전체 백업 (코드만)
./Scripts/backups/backup_projects.sh --group-id 123

# 전체 백업 (위키, 이슈, 설정 포함)
./Scripts/backups/backup_projects.sh --group-id 123 \
  --include-wiki \
  --include-issues \
  --include-settings

# 압축 형식과 보관 기간 지정
./Scripts/backups/backup_projects.sh --group-id 123 \
  --compression zip \
  --retention 7
```

## 디렉토리 구조

```
Scripts/
├── lib/                    # 공통 라이브러리
│   ├── common.sh          # 공통 함수 (로깅, API 호출 등)
│   └── validation.sh      # 입력값 검증 함수
├── groups/                # 그룹 관리 스크립트
│   ├── create_groups.sh
│   ├── delete_groups.sh
│   ├── list_groups.sh
│   └── update_group_settings.sh
├── projects/              # 프로젝트 관리 스크립트
│   ├── create_gitlab_projects.sh
│   ├── update_gitlab_projects.sh
│   ├── delete_projects.sh
│   ├── clone_all_projects.sh
│   └── force-push.sh
├── backups/               # 백업 스크립트
│   └── backup_projects.sh
├── config/                # 설정 파일
│   ├── gitlab.env.example
│   ├── gitlab.env
│   └── projects.txt
└── logs/                  # 로그 파일 (자동 생성)
```

## 팁과 모범 사례

### 1. Dry-run 모드 사용
실제 작업 전에 `--dry-run` 옵션으로 먼저 테스트하세요:
```bash
./Scripts/groups/delete_groups.sh --id 123 --dry-run
```

### 2. 로그 확인
모든 스크립트는 `Scripts/logs/` 디렉토리에 로그를 저장합니다:
```bash
# 최신 로그 확인
ls -lt Scripts/logs/ | head
tail -f Scripts/logs/create_groups_*.log
```

### 3. 병렬 처리
대량 작업 시 `--parallel` 옵션으로 속도 향상:
```bash
./Scripts/projects/clone_all_projects.sh --group-id 123 --parallel 10
```

### 4. 정기 백업
cron을 사용한 자동 백업 설정:
```bash
# 매일 새벽 2시에 백업 실행
0 2 * * * /path/to/Scripts/backups/backup_projects.sh --group-id 123 --retention 30
```

### 5. 일괄 작업용 파일 형식

**groups.txt** (그룹 생성용):
```
# 그룹명|경로|부모ID|설명|가시성
Frontend Team|frontend||프론트엔드 개발팀|private
Backend Team|backend||백엔드 개발팀|internal
```

**projects.txt** (프로젝트 생성용):
```
# 카테고리
project-name-1
project-name-2

# 다른 카테고리
project-name-3
```

## 문제 해결

### API 토큰 권한 부족
```bash
# 필요한 권한 확인
- api
- read_api
- read_repository
- write_repository
```

### jq 명령어 없음
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

## 기여하기

이 프로젝트에 기여하고 싶으시다면:
1. Fork 후 새 브랜치 생성
2. 변경사항 커밋
3. Pull Request 제출

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.