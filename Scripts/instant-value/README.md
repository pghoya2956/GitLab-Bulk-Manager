# GitLab Instant Value Automation Suite

## 🎯 핵심 목표: "설치 후 5분 안에 첫 번째 가치 실현"

### 📋 스크립트 목록

1. **gitlab-health-check.sh** - 30초 만에 GitLab 전체 상태 파악
2. **gitlab-quick-clone.sh** - 스마트 선택적 프로젝트 클론
3. **gitlab-merge-assistant.sh** - MR 자동 분석 및 추천
4. **gitlab-cost-analyzer.sh** - 리소스 사용량 및 비용 분석
5. **gitlab-daily-digest.sh** - 매일 아침 받는 GitLab 요약 리포트

## 🚀 Quick Start

```bash
# 1. 환경 설정
cp ../config/gitlab.env.example ../config/gitlab.env
vim ../config/gitlab.env

# 2. 첫 번째 건강 체크 실행
./gitlab-health-check.sh

# 3. 일일 리포트 설정
crontab -e
# 0 9 * * * /path/to/gitlab-daily-digest.sh
```

## 💡 왜 이 스크립트들인가?

- **즉시 실행 가능**: 복잡한 설정 불필요
- **눈에 보이는 가치**: 첫 실행에서 바로 유용한 정보 제공
- **점진적 확장**: 필요에 따라 기능 추가 가능
- **기존 인프라 활용**: 이미 있는 common.sh와 validation.sh 재사용