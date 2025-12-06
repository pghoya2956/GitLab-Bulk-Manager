import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import logger from '../utils/logger.js';

let sessionStore = undefined;

// Redis 연결 설정 (환경변수가 있을 경우에만)
if (process.env.REDIS_URL) {
  const redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
  });

  redisClient.connect().catch((err) => {
    logger.error('Redis Connection Failed:', err);
  });

  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'gbm:sess:',
  });
}

export const sessionConfig = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'default-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
  name: 'gitlab-manager-session',
};
