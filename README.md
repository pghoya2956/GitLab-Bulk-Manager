# GitLab Enterprise Management Suite

통합 GitLab 관리 자동화 플랫폼 - 그룹, 프로젝트, 사용자, CI/CD, 보안, 비용 최적화를 포함한 완전한 GitLab 관리 솔루션입니다.

## 🌟 주요 특징

### 기본 관리 기능
- **그룹 관리**: 계층적 그룹 구조 생성, 수정, 삭제
- **프로젝트 관리**: 대량 프로젝트 생성, 클론, 백업
- **사용자 관리**: 멤버 추가/제거, 권한 관리, 액세스 제어
- **백업 및 복구**: 자동화된 백업, 설정 보존

### 지능형 자동화 모듈
- **비용 최적화**: 스토리지 분석, CI/CD 시간 최적화
- **보안 및 컴플라이언스**: 권한 감사, 규정 준수 검사
- **생산성 인사이트**: 팀 메트릭, 번아웃 예측
- **긴급 대응**: 자동 확장, 부하 분산
- **외부 통합**: Slack, Jira, Jenkins, AWS 연동

## 📋 목차

- [빠른 시작](#빠른-시작)
- [설치 및 설정](#설치-및-설정)
- [기본 기능](#기본-기능)
  - [그룹 관리](#그룹-관리)
  - [프로젝트 관리](#프로젝트-관리)
  - [사용자 관리](#사용자-관리)
  - [백업](#백업)
- [고급 기능](#고급-기능)
  - [대량 작업](#대량-작업)
  - [비용 최적화](#비용-최적화)
  - [보안 및 컴플라이언스](#보안-및-컴플라이언스)
  - [생산성 분석](#생산성-분석)
  - [통합 관리](#통합-관리)
- [디렉토리 구조](#디렉토리-구조)
- [설정 파일 형식](#설정-파일-형식)
- [문제 해결](#문제-해결)

## 🚀 빠른 시작

### 30초 설치

```bash
# 1. 저장소 클론
git clone <repository-url>
cd GitLab

# 2. 환경 설정
cp Scripts/config/gitlab.env.example Scripts/config/gitlab.env
# gitlab.env 파일을 편집하여 GITLAB_URL과 GITLAB_TOKEN 설정

# 3. 실행 권한 부여 (이미 설정됨)
find Scripts -name "*.sh" -type f -exec chmod +x {} \;

# 4. 즉시 가치를 확인하려면 instant-value 디렉토리 참조
cd Scripts/instant-value && ./install.sh
```

### 첫 번째 명령어

```bash
# GitLab 상태 확인
./Scripts/instant-value/gitlab-health-check.sh

# 그룹 목록 조회
./Scripts/groups/list_groups.sh

# 비용 분석
./Scripts/cost_optimization/storage_analyzer.sh --days 30
```

## 🔧 설치 및 설정

### 필수 요구사항

- Bash 4.0+
- curl
- jq (JSON 처리)
- git
- bc (계산용, 선택사항)

### GitLab API 토큰 설정

1. GitLab에서 개인 액세스 토큰 생성:
   - User Settings > Access Tokens
   - 필요한 스코프: `api`, `read_api`, `read_repository`, `write_repository`

2. 환경 파일 설정:
```bash
cp Scripts/config/gitlab.env.example Scripts/config/gitlab.env
```

3. `Scripts/config/gitlab.env` 편집:
```bash
GITLAB_URL="https://gitlab.example.com"
GITLAB_TOKEN="YOUR_GITLAB_TOKEN_HERE"
```

## 📚 기본 기능

### 그룹 관리

#### 그룹 생성
```bash
# 단일 그룹 생성
./Scripts/groups/create_groups.sh --name "개발팀" --path "dev-team" --description "개발팀 그룹"

# 하위 그룹 생성
./Scripts/groups/create_groups.sh --name "백엔드팀" --parent_id 123 --visibility internal

# 파일에서 일괄 생성
./Scripts/groups/create_groups.sh --from-file Scripts/config/groups.txt

# 계층적 조직 구조 생성
./Scripts/batch/create_organization.sh --from-file Scripts/config/organization.txt
```

#### 그룹 조회 및 관리
```bash
# 모든 그룹 목록
./Scripts/groups/list_groups.sh

# 검색 및 필터링
./Scripts/groups/list_groups.sh --search "dev" --min-access maintainer --format json

# 그룹 설정 변경
./Scripts/groups/update_group_settings.sh --id 123 --visibility private --project-creation 2

# 그룹 삭제
./Scripts/groups/delete_groups.sh --id 123 --include-subgroups
```

### 프로젝트 관리

#### 프로젝트 생성
```bash
# 단일 프로젝트 생성
./Scripts/projects/create_gitlab_projects.sh --group_id 123

# projects.txt에서 일괄 생성
./Scripts/projects/create_gitlab_projects.sh --group_id 123

# 상세 설정으로 일괄 생성
./Scripts/batch/create_projects_by_group.sh --from-file Scripts/config/projects-by-group.txt
```

#### 프로젝트 클론 및 백업
```bash
# 그룹의 모든 프로젝트 클론
./Scripts/projects/clone_all_projects.sh --group-id 123 --output-dir /backup/gitlab

# 병렬 처리로 빠른 클론
./Scripts/projects/clone_all_projects.sh --group-id 123 --parallel 10

# 스마트 선택적 클론
./Scripts/instant-value/gitlab-quick-clone.sh --group backend --language python
```

### 사용자 관리

#### 멤버 관리
```bash
# 멤버 추가
./Scripts/users/manage_members.sh add --project-id 123 --username john.doe --level developer

# 그룹에 여러 멤버 추가
./Scripts/users/manage_members.sh add --group-id 456 --from-file members.txt

# 멤버 권한 변경
./Scripts/users/manage_members.sh update --project-id 123 --user-id 789 --level maintainer

# 멤버 제거
./Scripts/users/manage_members.sh remove --group-id 456 --username jane.doe

# 멤버 목록 조회
./Scripts/users/manage_members.sh list --group-id 456 --format csv > members.csv
```

### 백업

```bash
# 기본 백업 (코드만)
./Scripts/backups/backup_projects.sh --group-id 123

# 전체 백업 (위키, 이슈, 설정 포함)
./Scripts/backups/backup_projects.sh --group-id 123 \
  --include-wiki \
  --include-issues \
  --include-settings \
  --compression zip
```

## 🚀 고급 기능

### 대량 작업

#### 조직 구조 일괄 생성
```bash
# 방법 1: 전체 조직 구조 생성
./Scripts/batch/create_organization.sh --from-file Scripts/config/organization.txt

# 방법 2: 특정 부모 그룹 아래에 생성
./Scripts/batch/create_subgroups.sh --parent-id 100 --from-file Scripts/config/subgroups.txt

# 방법 3: 그룹 ID 기반 프로젝트 생성
./Scripts/batch/create_projects_by_group.sh --from-file Scripts/config/projects-by-group.txt
```

### 비용 최적화

#### 스토리지 분석
```bash
# 스토리지 낭비 요소 식별
./Scripts/cost_optimization/storage_analyzer.sh --threshold 5 --inactive 180

# 그룹별 분석
./Scripts/cost_optimization/storage_analyzer.sh --group-id 123 --format json

# 정리 스크립트 생성
./Scripts/cost_optimization/storage_analyzer.sh --cleanup > cleanup_commands.sh
```

#### CI/CD 최적화
```bash
# 파이프라인 성능 분석
./Scripts/cost_optimization/ci_time_optimizer.sh --project 123 --days 30

# 최적화된 CI 설정 생성
./Scripts/cost_optimization/ci_time_optimizer.sh --group 456 --config --optimize aggressive
```

### 보안 및 컴플라이언스

#### 권한 감사
```bash
# 스마트 권한 분석
./Scripts/intelligence/smart_permissions.sh --group-id 123 --inactive 60

# 자동 권한 최적화
./Scripts/intelligence/smart_permissions.sh --auto-fix --dry-run
```

#### 컴플라이언스 검사
```bash
# 전체 컴플라이언스 체크
./Scripts/compliance/compliance_checker.sh --group 123 --type all

# 보안 감사 리포트
./Scripts/compliance/compliance_checker.sh --project 456 --type security --format html > audit.html

# 자동 수정
./Scripts/compliance/compliance_checker.sh --group 123 --auto-fix
```

### 생산성 분석

#### 팀 메트릭
```bash
# 생산성 대시보드
./Scripts/insights/productivity_metrics.sh --period 30 --format dashboard > metrics.html

# 팀 비교 분석
./Scripts/insights/productivity_metrics.sh --group-id 123 --compare --export
```

#### 번아웃 예측
```bash
# 팀 웰빙 체크
./Scripts/insights/burnout_predictor.sh --days 90 --group-id 123

# 상세 리포트 생성
./Scripts/insights/burnout_predictor.sh --format report --alerts > wellbeing_report.md
```

### 긴급 대응

```bash
# 시스템 모니터링
./Scripts/emergency/emergency_auto_scale.sh --mode monitor --interval 30

# 자동 확장 활성화
./Scripts/emergency/emergency_auto_scale.sh --mode auto --auto-scale --cpu 75

# 수동 긴급 대응
./Scripts/emergency/emergency_auto_scale.sh --mode manual
```

### 통합 관리

```bash
# Slack 설정
./Scripts/integrations/integration_hub.sh slack setup

# Jira 이슈 동기화
./Scripts/integrations/integration_hub.sh jira sync

# Jenkins 빌드 트리거
./Scripts/integrations/integration_hub.sh jenkins trigger --project 123 --branch main

# 통합 상태 확인
./Scripts/integrations/integration_hub.sh status
```

## 📁 디렉토리 구조

```
GitLab/
├── LICENSE                         # MIT 라이선스
├── README.md                      # 이 문서
├── .gitignore                     # Git 무시 파일
└── Scripts/
    ├── lib/                       # 공통 라이브러리
    │   ├── common.sh             # 핵심 공통 함수
    │   └── validation.sh         # 입력 검증 함수
    ├── groups/                    # 그룹 관리
    │   ├── create_groups.sh
    │   ├── delete_groups.sh
    │   ├── list_groups.sh
    │   └── update_group_settings.sh
    ├── projects/                  # 프로젝트 관리
    │   ├── create_gitlab_projects.sh
    │   ├── update_gitlab_projects.sh
    │   ├── delete_projects.sh
    │   ├── clone_all_projects.sh
    │   └── force-push.sh
    ├── users/                     # 사용자 관리
    │   └── manage_members.sh
    ├── backups/                   # 백업 관리
    │   └── backup_projects.sh
    ├── batch/                     # 대량 작업
    │   ├── create_organization.sh
    │   ├── create_subgroups.sh
    │   ├── create_projects_by_group.sh
    │   └── setup_gitlab_full.sh
    ├── instant-value/             # 즉시 가치 제공 도구
    │   ├── README.md
    │   ├── install.sh
    │   ├── gitlab-health-check.sh
    │   ├── gitlab-daily-digest.sh
    │   ├── gitlab-cost-analyzer.sh
    │   ├── gitlab-merge-assistant.sh
    │   └── gitlab-quick-clone.sh
    ├── cost_optimization/         # 비용 최적화
    │   ├── storage_analyzer.sh
    │   └── ci_time_optimizer.sh
    ├── intelligence/              # 지능형 자동화
    │   └── smart_permissions.sh
    ├── compliance/                # 컴플라이언스
    │   └── compliance_checker.sh
    ├── insights/                  # 인사이트 및 분석
    │   ├── productivity_metrics.sh
    │   └── burnout_predictor.sh
    ├── emergency/                 # 긴급 대응
    │   └── emergency_auto_scale.sh
    ├── merge_automation/          # 머지 자동화
    │   └── auto_conflict_resolver.sh
    ├── integrations/              # 외부 서비스 통합
    │   └── integration_hub.sh
    ├── config/                    # 설정 파일
    │   ├── gitlab.env.example    # 환경 설정 예시
    │   ├── gitlab.env            # 실제 환경 설정 (git 무시)
    │   ├── projects.txt          # 프로젝트 목록
    │   ├── *.example             # 다양한 설정 파일 예시
    │   └── integrations.conf     # 통합 설정 (git 무시)
    └── logs/                      # 로그 파일 (자동 생성)
```

## 📝 설정 파일 형식

### groups.txt (그룹 일괄 생성)
```
# 형식: 이름|경로|부모ID|설명|가시성
Frontend Team|frontend||프론트엔드 개발팀|private
Backend Team|backend||백엔드 개발팀|internal
```

### organization.txt (계층적 조직 구조)
```
# 들여쓰기로 계층 표현 (2칸)
개발본부|dev-division|private|개발 조직
  프론트엔드팀|frontend|internal|UI 개발
    웹개발파트|web|private|웹 애플리케이션
    모바일파트|mobile|private|모바일 앱
  백엔드팀|backend|internal|서버 개발
```

### subgroups.txt (특정 부모 아래 하위 그룹)
```
# 부모 그룹 ID 지정 후 사용
프론트엔드팀|frontend|internal|웹/모바일 UI 개발
  웹개발파트|web|private|웹 애플리케이션 개발
  모바일파트|mobile|private|iOS/Android 앱 개발
백엔드팀|backend|internal|API 및 서버 개발
```

### projects.txt (단순 프로젝트 목록)
```
# 카테고리명 (프로젝트 설명이 됨)
# 웹 애플리케이션
web-main
web-admin
web-mobile

# API 서비스
api-gateway
api-auth
api-user
```

### projects-by-group.txt (그룹 ID 기반 프로젝트)
```
# 형식: 프로젝트명|그룹ID|설명|가시성|이슈활성화|위키활성화|기본브랜치
web-main|110|메인 웹사이트|private|true|true|main
api-gateway|120|API 게이트웨이|internal|true|false|main
ml-model|132|머신러닝 모델|private|true|true|develop
```

### members.txt (멤버 일괄 관리)
```
# 형식: 사용자명/이메일|액세스레벨|만료일(선택)
john.doe|developer|
jane.smith|maintainer|2024-12-31
admin@company.com|owner|
```

## 🛠️ 팁과 모범 사례

### 1. 항상 Dry-run 먼저
```bash
# 실제 실행 전 테스트
./Scripts/groups/delete_groups.sh --id 123 --dry-run
```

### 2. 로그 모니터링
```bash
# 실시간 로그 확인
tail -f Scripts/logs/create_groups_*.log

# 디버그 모드
LOG_LEVEL=DEBUG ./Scripts/groups/create_groups.sh --name "Test"
```

### 3. 병렬 처리 활용
```bash
# 대량 클론 시 병렬 처리
./Scripts/projects/clone_all_projects.sh --group-id 123 --parallel 10
```

### 4. 정기 작업 자동화
```bash
# Crontab 예시
# 매일 새벽 2시 백업
0 2 * * * /path/to/Scripts/backups/backup_projects.sh --group-id 123 --retention 30

# 매주 월요일 팀 리포트
0 9 * * 1 /path/to/Scripts/insights/productivity_metrics.sh --format report --email team@company.com

# 매시간 시스템 체크
0 * * * * /path/to/Scripts/instant-value/gitlab-health-check.sh --alert-on-failure
```

### 5. 환경 변수 활용
```bash
# 일회성 실행
GITLAB_TOKEN=temp-token ./Scripts/groups/list_groups.sh

# Dry-run 환경 변수
DRY_RUN=true ./Scripts/projects/delete_projects.sh --group-id 123

# 기존 리소스 스킵
SKIP_EXISTING=true ./Scripts/batch/create_organization.sh --from-file org.txt
```

## 🔧 문제 해결

### 일반적인 문제

#### API 토큰 권한 부족
```bash
Error: 403 Forbidden
해결: 토큰에 다음 스코프가 있는지 확인
- api
- read_api  
- read_repository
- write_repository
```

#### jq 명령어 없음
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

#### 대량 작업 시 API 제한
```bash
Error: 429 Too Many Requests
해결: --parallel 옵션 값을 낮추거나 스크립트에 sleep 추가
```

### 디버깅

```bash
# 상세 로그 활성화
LOG_LEVEL=DEBUG ./Scripts/groups/create_groups.sh --name "Test"

# API 응답 확인
curl -H "Private-Token: $GITLAB_TOKEN" "$GITLAB_URL/api/v4/groups"

# 스크립트 디버깅
bash -x ./Scripts/groups/create_groups.sh --name "Test"
```

## 📊 성능 및 제한사항

- GitLab API 속도 제한: 600 요청/분 (인증된 사용자)
- 대량 작업 시 `--parallel` 옵션으로 속도 조절
- 큰 저장소 클론 시 `--shallow` 옵션 사용 권장
- 로그 파일은 자동으로 30일 후 정리됨

## 🤝 기여하기

1. Fork 후 기능 브랜치 생성
2. 코드 작성 및 테스트
3. 커밋 메시지는 명확하게
4. Pull Request 제출

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

이 프로젝트는 GitLab 커뮤니티와 오픈소스 기여자들의 도움으로 만들어졌습니다.

---

**문의사항이나 버그 리포트는 Issues 섹션을 이용해 주세요.**