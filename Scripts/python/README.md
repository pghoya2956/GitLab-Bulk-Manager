# GitLab CLI - Python Implementation (Future)

이 디렉토리는 향후 Python CLI 구현을 위한 설계 문서입니다.

## 배경

현재 Shell 스크립트 기반 구현이 잘 작동하지만, 다음과 같은 경우 Python 전환이 필요합니다:
- 복잡한 데이터 구조 처리
- 비동기/병렬 처리 요구
- 고급 오류 처리
- 단위 테스트 필요성

## 아키텍처 설계

### 프로젝트 구조
```
gitlab-cli/
├── gitlab_cli/
│   ├── __init__.py
│   ├── cli.py              # Click CLI 진입점
│   ├── config.py           # 설정 관리
│   ├── api/
│   │   ├── __init__.py
│   │   ├── client.py       # GitLab API 클라이언트
│   │   ├── groups.py       # 그룹 관련 API
│   │   ├── projects.py     # 프로젝트 관련 API
│   │   └── rate_limiter.py # Rate limiting
│   ├── commands/
│   │   ├── __init__.py
│   │   ├── groups.py       # 그룹 명령어
│   │   ├── projects.py     # 프로젝트 명령어
│   │   └── bulk.py         # 대량 작업 명령어
│   └── utils/
│       ├── __init__.py
│       ├── yaml_parser.py  # YAML 파싱
│       ├── progress.py     # 진행률 표시
│       └── validators.py   # 입력 검증
├── tests/
│   ├── test_api.py
│   ├── test_commands.py
│   └── test_utils.py
├── setup.py
├── requirements.txt
└── README.md
```

## 핵심 기능

### 1. GitLab API 클라이언트
```python
# gitlab_cli/api/client.py
import asyncio
import aiohttp
from typing import Optional, Dict, Any

class GitLabClient:
    def __init__(self, url: str, token: str):
        self.url = url
        self.token = token
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={"PRIVATE-TOKEN": self.token}
        )
        return self
        
    async def request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Rate limited API request with retry logic"""
        # Implementation with exponential backoff
        pass
```

### 2. CLI 인터페이스
```python
# gitlab_cli/cli.py
import click
import asyncio
from .commands import groups, projects, bulk

@click.group()
@click.option('--config', '-c', help='Configuration file')
@click.pass_context
def cli(ctx, config):
    """GitLab CLI for bulk operations"""
    ctx.ensure_object(dict)
    ctx.obj['config'] = load_config(config)

cli.add_command(groups.group)
cli.add_command(projects.project)
cli.add_command(bulk.bulk)
```

### 3. 대량 작업 명령어
```python
# gitlab_cli/commands/bulk.py
import click
import asyncio
from ..utils.yaml_parser import parse_yaml
from ..api.client import GitLabClient

@click.group(name='bulk')
def bulk():
    """Bulk operations commands"""
    pass

@bulk.command()
@click.option('--file', '-f', required=True, help='YAML configuration file')
@click.option('--dry-run', is_flag=True, help='Preview without creating')
@click.option('--parallel', '-p', default=5, help='Parallel workers')
@click.pass_context
async def create_projects(ctx, file, dry_run, parallel):
    """Create projects in bulk from YAML"""
    config = parse_yaml(file)
    
    async with GitLabClient(ctx.obj['url'], ctx.obj['token']) as client:
        # Parallel processing with semaphore
        semaphore = asyncio.Semaphore(parallel)
        tasks = []
        
        for group in config['projects']:
            for project in group['projects']:
                task = create_project_async(client, project, semaphore)
                tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        # Progress reporting and error handling
```

## 주요 개선사항

### 1. 비동기 처리
- aiohttp를 사용한 비동기 API 호출
- 동시 요청 수 제한 (Semaphore)
- 효율적인 대량 작업

### 2. 강력한 오류 처리
```python
class GitLabAPIError(Exception):
    """Base exception for GitLab API errors"""
    pass

class RateLimitError(GitLabAPIError):
    """Rate limit exceeded"""
    def __init__(self, reset_time):
        self.reset_time = reset_time
```

### 3. 진행률 표시
```python
from rich.progress import Progress, SpinnerColumn, BarColumn

async def bulk_operation_with_progress(items):
    with Progress(
        SpinnerColumn(),
        "[progress.description]{task.description}",
        BarColumn(),
        "[progress.percentage]{task.percentage:>3.0f}%",
    ) as progress:
        task = progress.add_task("Processing...", total=len(items))
        # Update progress as items complete
```

### 4. 설정 관리
```python
from pydantic import BaseModel, Field

class GitLabConfig(BaseModel):
    url: str = Field(..., env='GITLAB_URL')
    token: str = Field(..., env='GITLAB_TOKEN')
    api_version: str = 'v4'
    timeout: int = 30
    max_retries: int = 3
```

## 마이그레이션 전략

### Phase 1: 하이브리드 접근
```bash
#!/bin/bash
# Shell 래퍼로 Python 코어 기능 호출
python3 -m gitlab_cli.bulk create-projects --file projects.yaml "$@"
```

### Phase 2: 점진적 기능 이전
1. 복잡한 YAML 파싱 → Python
2. API 클라이언트 → Python
3. 대량 작업 → Python
4. 단순 작업 → Shell 유지

### Phase 3: 완전 전환
- 모든 기능 Python으로 이전
- Shell 스크립트는 레거시 지원용

## 개발 요구사항

### 의존성
```txt
# requirements.txt
click>=8.0
aiohttp>=3.8
pydantic>=2.0
pyyaml>=6.0
rich>=13.0
pytest>=7.0
pytest-asyncio>=0.21
python-gitlab>=3.0  # Optional: Official SDK
```

### 개발 환경
```bash
# 가상환경 설정
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 개발 모드 설치
pip install -e .
```

## 테스트 전략

### 단위 테스트
```python
# tests/test_api.py
import pytest
from gitlab_cli.api.client import GitLabClient

@pytest.mark.asyncio
async def test_rate_limiting():
    """Test rate limit handling"""
    async with GitLabClient("http://test", "token") as client:
        # Mock 429 response
        # Verify retry behavior
```

### 통합 테스트
- Docker를 사용한 GitLab 인스턴스
- 실제 API 호출 테스트
- 대량 작업 시뮬레이션

## 성능 목표

### 벤치마크
- 1000개 프로젝트 생성: <5분
- 메모리 사용: <100MB
- 동시 연결: 10-20개

### 최적화 전략
1. 연결 풀링
2. 요청 배칭
3. 캐싱 (적절한 경우)
4. 스트리밍 응답 처리

## 보안 고려사항

### 토큰 관리
- 환경 변수 우선
- 설정 파일 암호화 옵션
- 토큰 만료 처리

### 입력 검증
- Pydantic 모델 사용
- SQL 인젝션 방지
- 경로 트래버설 방지

## 로드맵

### v1.0 (MVP)
- [x] 아키텍처 설계
- [ ] 기본 API 클라이언트
- [ ] 그룹/프로젝트 생성
- [ ] YAML 설정 지원

### v2.0
- [ ] 비동기 대량 작업
- [ ] 진행률 표시
- [ ] 고급 오류 처리
- [ ] 플러그인 시스템

### v3.0
- [ ] Web UI
- [ ] GitOps 통합
- [ ] Terraform 프로바이더