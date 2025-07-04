# Shell Script Complexity Guidelines

이 문서는 GitLab 자동화 프로젝트의 Shell 스크립트 복잡도 관리 가이드라인입니다.

## 복잡도 한계점

### 파일 크기 기준
- **권장**: 300줄 이하
- **경고**: 300-500줄
- **위험**: 500줄 초과 → Python/Go 전환 고려

### 함수 복잡도
- **권장**: 함수당 50줄 이하
- **최대**: 100줄
- 중첩 깊이: 최대 3단계

### 조건문 복잡도
- if/elif 체인: 최대 5개
- case 문: 최대 10개 케이스
- 중첩 조건문: 최대 2단계

## 복잡도 증가 신호

### 즉시 리팩토링 필요
1. 동일한 코드가 3번 이상 반복
2. 함수가 100줄 초과
3. 파일이 500줄 초과
4. 테스트하기 어려운 로직 등장

### Python 전환 고려
1. JSON/YAML 복잡한 변환 필요
2. 병렬 처리 요구사항
3. 복잡한 오류 처리 로직
4. 외부 API 다수 연동

## 모듈화 전략

### 현재 구조 (Good)
```
lib/
├── common.sh        # 공통 유틸리티
├── validation.sh    # 입력 검증
└── idempotent.sh   # 멱등성 함수
```

### 추가 분리 권장
```
lib/
├── yaml_parser.sh   # YAML 파싱 전용
├── api_client.sh    # API 호출 전용
├── error_handler.sh # 오류 처리 전용
└── progress.sh      # 진행률 표시 전용
```

## 복잡도 측정 도구

### 1. 줄 수 확인
```bash
find Scripts -name "*.sh" -exec wc -l {} + | sort -n
```

### 2. 함수 복잡도 확인
```bash
# 함수당 줄 수 계산
grep -n "^[[:space:]]*[[:alnum:]_]*()[[:space:]]*{" script.sh
```

### 3. 중첩 깊이 확인
```bash
# 들여쓰기 레벨 확인
awk '{print gsub(/^[ \t]+/, "")}' script.sh | sort -n | tail -1
```

## 리팩토링 패턴

### 1. 반복 코드 → 함수 추출
```bash
# Before
response=$(gitlab_api "GET" "/groups/$id1")
http_code=$?
if [[ $http_code -ne 200 ]]; then
    log "ERROR" "Failed"
fi

response=$(gitlab_api "GET" "/groups/$id2")
http_code=$?
if [[ $http_code -ne 200 ]]; then
    log "ERROR" "Failed"
fi

# After
check_group() {
    local id=$1
    response=$(gitlab_api "GET" "/groups/$id")
    http_code=$?
    if [[ $http_code -ne 200 ]]; then
        log "ERROR" "Failed for group $id"
        return 1
    fi
    echo "$response"
}
```

### 2. 긴 함수 → 작은 함수들로 분리
```bash
# Before
create_project() {
    # 100+ lines of validation, creation, setup...
}

# After
create_project() {
    validate_project_params "$@" || return 1
    local project_id=$(create_project_resource "$@")
    setup_project_settings "$project_id"
    configure_project_protection "$project_id"
}
```

### 3. 복잡한 조건문 → 전략 패턴
```bash
# Before
if [[ "$type" == "group" ]]; then
    # 20 lines of group logic
elif [[ "$type" == "project" ]]; then
    # 20 lines of project logic
elif [[ "$type" == "user" ]]; then
    # 20 lines of user logic
fi

# After
handle_$type "$@"  # handle_group, handle_project, handle_user
```

## Python 전환 시점

### 전환 트리거
1. **데이터 구조**: 복잡한 중첩 데이터 처리
2. **오류 처리**: try/except가 필요한 수준
3. **비동기 작업**: 동시 실행 요구사항
4. **테스트**: 단위 테스트 필요성 증가

### 전환 전략
```python
# 1단계: Shell 래퍼 + Python 코어
#!/bin/bash
python3 scripts/core_logic.py "$@"

# 2단계: 완전 Python CLI
#!/usr/bin/env python3
import click
@click.command()
def main():
    pass
```

## 현재 스크립트 평가

### 우수 (복잡도 관리 잘됨)
- `lib/validation.sh`: 단순 함수 모음
- `lib/idempotent.sh`: 명확한 단일 책임

### 주의 필요
- `create_subgroups_bulk.sh`: 300줄 접근
- `create_projects_bulk.sh`: 기능 추가 시 분리 필요

### 개선 권장사항
1. YAML 파싱 로직을 별도 라이브러리로 분리
2. API 호출 래퍼 함수 통합
3. 진행률 표시 로직 모듈화

## 모니터링 및 유지보수

### 정기 검토 (월 1회)
1. 스크립트 크기 증가 추세 확인
2. 새로운 기능 요구사항 평가
3. 테스트 커버리지 확인

### 리팩토링 체크리스트
- [ ] 300줄 이상 스크립트 확인
- [ ] 중복 코드 제거
- [ ] 복잡한 함수 분리
- [ ] 테스트 가능성 평가
- [ ] Python 전환 필요성 검토

## 결론

현재 Shell 스크립트 접근법은 적절하지만, 다음 신호 발생 시 Python 전환 준비:
- 파일당 500줄 초과
- 테스트 작성 어려움
- 디버깅 시간 증가
- 새 기능 추가 속도 저하