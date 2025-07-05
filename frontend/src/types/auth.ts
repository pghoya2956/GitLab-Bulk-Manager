export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at: string;
}


export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface GitLabAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  created_at: number;
}