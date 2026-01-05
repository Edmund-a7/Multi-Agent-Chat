// User type
export type User = {
  id: string;
  username: string;
  created_at: number;
}

// Authentication response type
export type AuthResponse = {
  user: User;
  token: string;
}
