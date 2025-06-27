#!/bin/bash

# 입력값 검증 함수 라이브러리

# 숫자 검증
is_number() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

# 그룹 ID 검증
validate_group_id() {
    local group_id="$1"
    
    if [[ -z "$group_id" ]]; then
        log ERROR "그룹 ID가 제공되지 않았습니다"
        return 1
    fi
    
    if ! is_number "$group_id"; then
        log ERROR "유효하지 않은 그룹 ID: $group_id"
        return 1
    fi
    
    return 0
}

# 프로젝트 ID 검증
validate_project_id() {
    local project_id="$1"
    
    if [[ -z "$project_id" ]]; then
        log ERROR "프로젝트 ID가 제공되지 않았습니다"
        return 1
    fi
    
    if ! is_number "$project_id"; then
        log ERROR "유효하지 않은 프로젝트 ID: $project_id"
        return 1
    fi
    
    return 0
}

# 프로젝트 이름 검증
validate_project_name() {
    local name="$1"
    
    if [[ -z "$name" ]]; then
        log ERROR "프로젝트 이름이 제공되지 않았습니다"
        return 1
    fi
    
    # GitLab 프로젝트 이름 규칙
    # - 알파벳, 숫자, 하이픈, 언더스코어만 허용
    # - 시작과 끝은 알파벳 또는 숫자
    if ! [[ "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$ ]] && ! [[ "$name" =~ ^[a-zA-Z0-9]$ ]]; then
        log ERROR "유효하지 않은 프로젝트 이름: $name"
        log ERROR "프로젝트 이름은 알파벳, 숫자, 하이픈, 언더스코어만 사용할 수 있습니다"
        return 1
    fi
    
    return 0
}

# 그룹 경로 검증
validate_group_path() {
    local path="$1"
    
    if [[ -z "$path" ]]; then
        log ERROR "그룹 경로가 제공되지 않았습니다"
        return 1
    fi
    
    # GitLab 그룹 경로 규칙
    if ! [[ "$path" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$ ]] && ! [[ "$path" =~ ^[a-zA-Z0-9]$ ]]; then
        log ERROR "유효하지 않은 그룹 경로: $path"
        return 1
    fi
    
    return 0
}

# 가시성 레벨 검증
validate_visibility() {
    local visibility="$1"
    
    case "$visibility" in
        private|internal|public)
            return 0
            ;;
        *)
            log ERROR "유효하지 않은 가시성 레벨: $visibility"
            log ERROR "사용 가능한 값: private, internal, public"
            return 1
            ;;
    esac
}

# 접근 레벨 검증
validate_access_level() {
    local level="$1"
    
    case "$level" in
        10|20|30|40|50)
            return 0
            ;;
        guest|reporter|developer|maintainer|owner)
            return 0
            ;;
        *)
            log ERROR "유효하지 않은 접근 레벨: $level"
            log ERROR "사용 가능한 값: 10(guest), 20(reporter), 30(developer), 40(maintainer), 50(owner)"
            return 1
            ;;
    esac
}

# 이메일 검증
validate_email() {
    local email="$1"
    
    if [[ -z "$email" ]]; then
        log ERROR "이메일이 제공되지 않았습니다"
        return 1
    fi
    
    if ! [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        log ERROR "유효하지 않은 이메일 형식: $email"
        return 1
    fi
    
    return 0
}

# URL 검증
validate_url() {
    local url="$1"
    
    if [[ -z "$url" ]]; then
        log ERROR "URL이 제공되지 않았습니다"
        return 1
    fi
    
    if ! [[ "$url" =~ ^https?:// ]]; then
        log ERROR "유효하지 않은 URL 형식: $url"
        return 1
    fi
    
    return 0
}

# 파일 경로 검증
validate_file_path() {
    local file="$1"
    local must_exist="${2:-true}"
    
    if [[ -z "$file" ]]; then
        log ERROR "파일 경로가 제공되지 않았습니다"
        return 1
    fi
    
    if [[ "$must_exist" == "true" ]] && [[ ! -f "$file" ]]; then
        log ERROR "파일을 찾을 수 없습니다: $file"
        return 1
    fi
    
    return 0
}

# 디렉토리 경로 검증
validate_directory_path() {
    local dir="$1"
    local must_exist="${2:-true}"
    
    if [[ -z "$dir" ]]; then
        log ERROR "디렉토리 경로가 제공되지 않았습니다"
        return 1
    fi
    
    if [[ "$must_exist" == "true" ]] && [[ ! -d "$dir" ]]; then
        log ERROR "디렉토리를 찾을 수 없습니다: $dir"
        return 1
    fi
    
    return 0
}

# 접근 레벨을 숫자로 변환
access_level_to_number() {
    local level="$1"
    
    case "$level" in
        guest) echo 10 ;;
        reporter) echo 20 ;;
        developer) echo 30 ;;
        maintainer) echo 40 ;;
        owner) echo 50 ;;
        *) echo "$level" ;;
    esac
}

# 숫자를 접근 레벨 이름으로 변환
number_to_access_level() {
    local number="$1"
    
    case "$number" in
        10) echo "guest" ;;
        20) echo "reporter" ;;
        30) echo "developer" ;;
        40) echo "maintainer" ;;
        50) echo "owner" ;;
        *) echo "unknown" ;;
    esac
}