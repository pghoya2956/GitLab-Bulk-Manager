import request from 'supertest';
import express from 'express';
import session from 'express-session';
import authRouter from '../routes/auth.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');

const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
      };

      axios.get.mockResolvedValueOnce({ data: mockUser });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          gitlabUrl: 'https://gitlab.com',
          personalAccessToken: 'test-token',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Login successful',
        user: mockUser,
      });
    });

    it('should fail with invalid token', async () => {
      axios.get.mockRejectedValueOnce({
        response: { status: 401 },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          gitlabUrl: 'https://gitlab.com',
          personalAccessToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid GitLab credentials');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('GitLab URL and Personal Access Token are required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return user session when authenticated', async () => {
      const agent = request.agent(app);

      // Mock login
      axios.get.mockResolvedValueOnce({
        data: { id: 1, username: 'testuser' },
      });

      await agent
        .post('/api/auth/login')
        .send({
          gitlabUrl: 'https://gitlab.com',
          personalAccessToken: 'test-token',
        });

      const response = await agent.get('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.gitlabUrl).toBe('https://gitlab.com');
    });

    it('should return unauthenticated when no session', async () => {
      const response = await request(app)
        .get('/api/auth/session');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });
  });
});