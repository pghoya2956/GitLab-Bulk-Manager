import express from 'express';
import axios from 'axios';
import { GITLAB_CONFIG } from '../config/constants.js';

const router = express.Router();

// Helper: GitLab API 호출 with timing
async function gitlabRequestWithTiming(req, path) {
  const token = req.session.gitlabToken;
  const baseURL = req.session.gitlabUrl || GITLAB_CONFIG.DEFAULT_URL;
  const startTime = Date.now();

  const response = await axios({
    method: 'GET',
    url: `${baseURL}${GITLAB_CONFIG.API_VERSION}${path}`,
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
    },
  });

  return {
    data: response.data,
    headers: response.headers,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * GET /api/health/connection
 * GitLab 연결 상태 + 서버 버전 + 응답 시간
 */
router.get('/connection', async (req, res) => {
  try {
    const result = await gitlabRequestWithTiming(req, '/version');

    res.json({
      status: 'healthy',
      latencyMs: result.latencyMs,
      gitlabVersion: result.data.version,
      gitlabRevision: result.data.revision,
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      latencyMs: null,
      gitlabVersion: null,
      error: error.response?.data?.message || error.message,
    });
  }
});

/**
 * GET /api/health/user
 * 사용자 정보 + 권한
 */
router.get('/user', async (req, res) => {
  try {
    const result = await gitlabRequestWithTiming(req, '/user');

    res.json({
      status: 'healthy',
      username: result.data.username,
      name: result.data.name,
      email: result.data.email,
      isAdmin: result.data.is_admin || false,
      avatarUrl: result.data.avatar_url,
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      error: error.response?.data?.message || error.message,
    });
  }
});

/**
 * GET /api/health/stats
 * 프로젝트/그룹 개수
 */
router.get('/stats', async (req, res) => {
  try {
    // 병렬로 프로젝트와 그룹 개수 조회
    const [projectsResult, groupsResult] = await Promise.all([
      gitlabRequestWithTiming(req, '/projects?per_page=1&membership=true'),
      gitlabRequestWithTiming(req, '/groups?per_page=1'),
    ]);

    res.json({
      status: 'healthy',
      projectCount: parseInt(projectsResult.headers['x-total'] || '0', 10),
      groupCount: parseInt(groupsResult.headers['x-total'] || '0', 10),
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      error: error.response?.data?.message || error.message,
    });
  }
});

/**
 * GET /api/health/rate-limit
 * API 레이트 리밋 현황
 */
router.get('/rate-limit', async (req, res) => {
  try {
    const result = await gitlabRequestWithTiming(req, '/version');
    const headers = result.headers;

    // GitLab API rate limit headers (다양한 형식 지원)
    const limit = parseInt(
      headers['ratelimit-limit'] ||
      headers['x-ratelimit-limit'] ||
      '0',
      10
    );
    const remaining = parseInt(
      headers['ratelimit-remaining'] ||
      headers['x-ratelimit-remaining'] ||
      '0',
      10
    );
    const resetTimestamp = parseInt(
      headers['ratelimit-reset'] ||
      headers['x-ratelimit-reset'] ||
      '0',
      10
    );

    // 리셋까지 남은 시간(초) 계산
    const now = Math.floor(Date.now() / 1000);
    const resetInSeconds = resetTimestamp > 0 ? Math.max(0, resetTimestamp - now) : null;

    res.json({
      status: limit > 0 ? 'healthy' : 'unknown',
      limit: limit || null,
      remaining: remaining || null,
      resetInSeconds,
      used: limit > 0 ? limit - remaining : null,
      usagePercent: limit > 0 ? Math.round(((limit - remaining) / limit) * 100) : null,
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      error: error.response?.data?.message || error.message,
    });
  }
});

/**
 * GET /api/health/session
 * 세션 정보 (GitLab URL, 세션 만료 시간)
 */
router.get('/session', async (req, res) => {
  try {
    const gitlabUrl = req.session.gitlabUrl || GITLAB_CONFIG.DEFAULT_URL;

    // 세션 만료 시간 계산
    let expiresInMinutes = null;
    if (req.session.cookie && req.session.cookie.maxAge) {
      expiresInMinutes = Math.round(req.session.cookie.maxAge / 1000 / 60);
    }

    res.json({
      status: 'healthy',
      gitlabUrl,
      expiresInMinutes,
      isAuthenticated: !!req.session.gitlabToken,
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * GET /api/health/quick
 * 빠른 상태 확인 (connection + session만, GitLab API 1회 호출)
 */
router.get('/quick', async (req, res) => {
  try {
    const gitlabUrl = req.session.gitlabUrl || GITLAB_CONFIG.DEFAULT_URL;
    const result = await gitlabRequestWithTiming(req, '/version');

    // 세션 만료 시간 계산
    let expiresInMinutes = null;
    if (req.session.cookie && req.session.cookie.maxAge) {
      expiresInMinutes = Math.round(req.session.cookie.maxAge / 1000 / 60);
    }

    res.json({
      connection: {
        status: 'healthy',
        latencyMs: result.latencyMs,
        gitlabVersion: result.data.version,
      },
      session: {
        status: 'healthy',
        gitlabUrl,
        expiresInMinutes,
      },
    });
  } catch (error) {
    res.json({
      connection: {
        status: 'unhealthy',
        error: error.response?.data?.message || error.message,
      },
      session: {
        status: req.session.gitlabToken ? 'healthy' : 'unhealthy',
        gitlabUrl: req.session.gitlabUrl || null,
      },
    });
  }
});

export default router;
