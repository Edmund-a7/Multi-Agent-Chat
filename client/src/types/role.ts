// Role type
export type Role = {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string;
  color: string;
  model?: string; // Optional specific model for this role
  created_at: number;
}

// Create/Update role request
export type RoleInput = {
  name: string;
  system_prompt: string;
  color: string;
  model?: string;
}
