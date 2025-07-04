import express from 'express';
import { gitlabProxy } from '../services/gitlabProxy.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Groups endpoints
router.get('/groups', gitlabProxy);
router.get('/groups/:id', gitlabProxy);
router.get('/groups/:id/subgroups', gitlabProxy);
router.get('/groups/:id/projects', gitlabProxy);
router.post('/groups', gitlabProxy);
router.put('/groups/:id', gitlabProxy);
router.delete('/groups/:id', gitlabProxy);
router.post('/groups/:id/transfer', gitlabProxy);

// Projects endpoints
router.get('/projects', gitlabProxy);
router.get('/projects/:id', gitlabProxy);
router.post('/projects', gitlabProxy);
router.put('/projects/:id', gitlabProxy);
router.delete('/projects/:id', gitlabProxy);
router.put('/projects/:id/transfer', gitlabProxy);

// Users endpoints
router.get('/users', gitlabProxy);
router.get('/users/:id', gitlabProxy);
router.get('/user', gitlabProxy);

// Members endpoints
router.get('/groups/:id/members', gitlabProxy);
router.post('/groups/:id/members', gitlabProxy);
router.put('/groups/:id/members/:user_id', gitlabProxy);
router.delete('/groups/:id/members/:user_id', gitlabProxy);

// Generic proxy for any other GitLab API endpoints
router.all('/*', gitlabProxy);

export default router;