import authReducer, { loginSuccess, logout, loginStart, loginFailure } from '../authSlice';

describe('authSlice', () => {
  const initialState = {
    isAuthenticated: false,
    user: null,
    token: null,
    gitlabUrl: null,
    loading: false,
    error: null,
  };

  const mockUser = {
    id: 1,
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://example.com/avatar.png',
    is_admin: false,
    created_at: '2023-01-01T00:00:00Z',
  };

  it('should handle initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle loginSuccess', () => {
    const action = loginSuccess({
      user: mockUser,
      token: 'test-token',
    });
    const state = authReducer(initialState, action);
    
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('test-token');
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should handle logout', () => {
    const loggedInState = {
      ...initialState,
      isAuthenticated: true,
      user: mockUser,
      token: 'test-token',
      gitlabUrl: 'https://gitlab.com',
    };
    
    const state = authReducer(loggedInState, logout());
    
    expect(state).toEqual(initialState);
  });

  it('should handle loginStart', () => {
    const state = authReducer(initialState, loginStart());
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should handle loginFailure', () => {
    const errorMessage = 'Authentication failed';
    const state = authReducer(initialState, loginFailure(errorMessage));
    
    expect(state.error).toBe(errorMessage);
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});