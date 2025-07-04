#!/bin/bash

# 스크립트 디렉토리 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# 공통 함수 로드
source "$BASE_DIR/lib/common.sh"

# 도움말 함수
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

GitLab 전체 구조를 설정 파일에 따라 일괄 구성합니다.

Options:
    --config-dir <DIR>     설정 파일 디렉토리 (기본값: Scripts/config)
    --steps <STEPS>        실행할 단계 (쉼표로 구분)
                          가능한 값: groups, projects, members, all
                          기본값: all
    --skip-existing        이미 존재하는 항목은 건너뛰기
    --dry-run              실제로 실행하지 않고 확인만
    -h, --help             이 도움말 표시

필요한 설정 파일들:
    - organization.txt     : 조직 구조 정의
    - projects-detailed.txt: 프로젝트 상세 설정
    - members.txt         : 멤버 할당 정보

Examples:
    # 전체 설정 적용
    $0
    
    # 그룹과 프로젝트만 생성
    $0 --steps groups,projects
    
    # dry-run으로 확인
    $0 --dry-run

실행 순서:
    1. 조직 구조 (그룹) 생성
    2. 프로젝트 생성 및 설정
    3. 멤버 할당
EOF
    exit 0
}

# 파라미터 파싱
CONFIG_DIR="$BASE_DIR/config"
STEPS="all"
SKIP_EXISTING=false
DRY_RUN_FLAG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --config-dir)
            CONFIG_DIR="$2"
            shift 2
            ;;
        --steps)
            STEPS="$2"
            shift 2
            ;;
        --skip-existing)
            SKIP_EXISTING=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            DRY_RUN_FLAG="--dry-run"
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log ERROR "알 수 없는 옵션: $1"
            show_help
            ;;
    esac
done

# 스크립트 초기화
init_script

log INFO "================================"
log INFO "GitLab 전체 구조 설정 시작"
log INFO "================================"
log INFO "설정 디렉토리: $CONFIG_DIR"
log INFO "실행 단계: $STEPS"
log INFO "기존 항목 건너뛰기: $SKIP_EXISTING"
if is_dry_run; then
    log WARN "DRY-RUN 모드: 실제 변경사항은 적용되지 않습니다"
fi
echo

# 단계별 실행 플래그
RUN_GROUPS=false
RUN_PROJECTS=false
RUN_MEMBERS=false

if [[ "$STEPS" == "all" ]]; then
    RUN_GROUPS=true
    RUN_PROJECTS=true
    RUN_MEMBERS=true
else
    IFS=',' read -ra STEP_ARRAY <<< "$STEPS"
    for step in "${STEP_ARRAY[@]}"; do
        case "$step" in
            groups) RUN_GROUPS=true ;;
            projects) RUN_PROJECTS=true ;;
            members) RUN_MEMBERS=true ;;
            *) log WARN "알 수 없는 단계: $step" ;;
        esac
    done
fi

# 추가 플래그 설정
SKIP_FLAG=""
if [[ "$SKIP_EXISTING" == "true" ]]; then
    SKIP_FLAG="--skip-existing"
fi

# 1단계: 조직 구조 (그룹) 생성
if [[ "$RUN_GROUPS" == "true" ]]; then
    log INFO "====== 1단계: 조직 구조 생성 ======"
    
    if [[ -f "$CONFIG_DIR/organization.txt" ]]; then
        log INFO "조직 구조 파일 발견: organization.txt"
        
        "$BASE_DIR/batch/create_organization.sh" \
            --from-file "$CONFIG_DIR/organization.txt" \
            $SKIP_FLAG \
            $DRY_RUN_FLAG
        
        if [[ $? -eq 0 ]]; then
            log INFO "✓ 조직 구조 생성 완료"
        else
            log ERROR "✗ 조직 구조 생성 실패"
            if ! is_dry_run; then
                error_exit "조직 구조 생성에 실패했습니다"
            fi
        fi
    else
        log WARN "organization.txt 파일을 찾을 수 없습니다"
        
        # 대체 방법: groups.txt 사용
        if [[ -f "$CONFIG_DIR/groups.txt" ]]; then
            log INFO "대체 파일 사용: groups.txt"
            
            "$BASE_DIR/groups/create_groups.sh" \
                --from-file "$CONFIG_DIR/groups.txt" \
                $DRY_RUN_FLAG
        fi
    fi
    
    echo
fi

# 2단계: 프로젝트 생성
if [[ "$RUN_PROJECTS" == "true" ]]; then
    log INFO "====== 2단계: 프로젝트 생성 ======"
    
    if [[ -f "$CONFIG_DIR/projects-detailed.txt" ]]; then
        log INFO "상세 프로젝트 파일 발견: projects-detailed.txt"
        
        # projects-detailed.txt 처리 스크립트가 없으므로 경고
        log WARN "projects-detailed.txt 처리 스크립트가 아직 구현되지 않았습니다"
        log INFO "대신 기본 프로젝트 생성 방식을 사용합니다"
    fi
    
    # 기본 projects.txt 처리
    if [[ -f "$CONFIG_DIR/projects.txt" ]]; then
        log INFO "프로젝트 목록 파일 발견: projects.txt"
        
        # 그룹 ID 입력 받기
        read -p "프로젝트를 생성할 그룹 ID를 입력하세요: " GROUP_ID
        
        if [[ -n "$GROUP_ID" ]]; then
            "$BASE_DIR/projects/create_gitlab_projects.sh" \
                --group_id "$GROUP_ID" \
                $DRY_RUN_FLAG
            
            if [[ $? -eq 0 ]]; then
                log INFO "✓ 프로젝트 생성 완료"
                
                # 프로젝트 설정 업데이트
                "$BASE_DIR/projects/update_gitlab_projects.sh" \
                    --group_id "$GROUP_ID" \
                    $DRY_RUN_FLAG
            else
                log ERROR "✗ 프로젝트 생성 실패"
            fi
        else
            log WARN "그룹 ID가 입력되지 않아 프로젝트 생성을 건너뜁니다"
        fi
    else
        log WARN "projects.txt 파일을 찾을 수 없습니다"
    fi
    
    echo
fi

# 3단계: 멤버 할당
if [[ "$RUN_MEMBERS" == "true" ]]; then
    log INFO "====== 3단계: 멤버 할당 ======"
    
    if [[ -f "$CONFIG_DIR/members.txt" ]]; then
        log INFO "멤버 목록 파일 발견: members.txt"
        
        # manage_members.sh 스크립트가 없으므로 경고
        log WARN "멤버 관리 스크립트가 아직 구현되지 않았습니다"
        log INFO "Scripts/users/manage_members.sh 스크립트 구현이 필요합니다"
    else
        log WARN "members.txt 파일을 찾을 수 없습니다"
    fi
    
    echo
fi

# 완료 메시지
log INFO "================================"
log INFO "GitLab 구조 설정 완료"
log INFO "================================"

# 다음 단계 안내
log INFO "다음 단계:"
log INFO "1. GitLab 웹 인터페이스에서 생성된 구조 확인"
log INFO "2. 필요한 경우 추가 설정 적용"
log INFO "3. 프로젝트 클론 및 백업 설정"

# 유용한 명령어 안내
echo
log INFO "유용한 명령어:"
log INFO "- 그룹 목록 확인: ./Scripts/groups/list_groups.sh"
log INFO "- 프로젝트 클론: ./Scripts/projects/clone_all_projects.sh --group-id [ID]"
log INFO "- 백업 실행: ./Scripts/backups/backup_projects.sh --group-id [ID]"