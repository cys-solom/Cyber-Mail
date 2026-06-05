// ============================================================
// Outlook Mail Pickup Dashboard — Type Definitions
// ============================================================

export type UserRole = 'admin' | 'employee';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountStatus = 'active' | 'inactive' | 'expired' | 'failed' | 'cooldown';

export interface EmailAccount {
  id: string;
  email: string;
  encrypted_password: string;
  client_id: string;
  encrypted_refresh_token: string;
  status: AccountStatus;
  health_score: number;
  last_checked_at?: string;
  last_code?: string;
  last_code_at?: string;
  notes?: string;
  assigned_to?: string;
  assigned_user?: UserProfile;
  token_expires_at?: string;
  total_fetches: number;
  total_otps: number;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface MailMessage {
  id: string;
  account_id: string;
  graph_message_id?: string;
  sender: string;
  subject?: string;
  body_preview?: string;
  received_at: string;
  is_read: boolean;
  has_otp: boolean;
  raw_body?: string;
  created_at: string;
}

export type OTPStatus = 'fresh' | 'copied' | 'used' | 'expired';
export type OTPType = 'otp' | 'verification' | 'security' | 'login' | '2fa';

export interface OTPResult {
  id: string;
  message_id: string;
  account_id: string;
  code: string;
  code_type: OTPType;
  sender?: string;
  subject?: string;
  extracted_at: string;
  used_at?: string;
  status: OTPStatus;
}

export type QueueStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface QueueSession {
  id: string;
  user_id: string;
  user?: UserProfile;
  started_at: string;
  ended_at?: string;
  accounts_processed: number;
  otps_found: number;
  status: QueueStatus;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user?: UserProfile;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AppSettings {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by?: string;
}

// API types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { line: number; email: string; error: string }[];
}

export interface OTPExtraction {
  code: string;
  type: OTPType;
  confidence: number;
}

export interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export interface DashboardStats {
  total_accounts: number;
  active_accounts: number;
  otps_today: number;
  avg_health: number;
  expiring_tokens: number;
  total_fetches_today: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}
