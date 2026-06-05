-- ============================================================
-- Outlook Mail Pickup Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Users Profile (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Email Accounts
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  encrypted_password TEXT NOT NULL,
  client_id TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','expired','failed','cooldown')),
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  last_checked_at TIMESTAMPTZ,
  last_code TEXT,
  last_code_at TIMESTAMPTZ,
  notes TEXT,
  assigned_to UUID REFERENCES users_profile(id),
  token_expires_at TIMESTAMPTZ,
  total_fetches INTEGER DEFAULT 0,
  total_otps INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#38bdf8',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Account Tags (M2M)
CREATE TABLE IF NOT EXISTS account_tags (
  account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, tag_id)
);

-- 5. Mail Messages
CREATE TABLE IF NOT EXISTS mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  graph_message_id TEXT UNIQUE,
  sender TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN DEFAULT false,
  has_otp BOOLEAN DEFAULT false,
  raw_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. OTP Results
CREATE TABLE IF NOT EXISTS otp_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES mail_messages(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  code_type TEXT DEFAULT 'otp' CHECK (code_type IN ('otp','verification','security','login','2fa')),
  sender TEXT,
  subject TEXT,
  extracted_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  status TEXT DEFAULT 'fresh' CHECK (status IN ('fresh','copied','used','expired'))
);

-- 7. Queue Sessions
CREATE TABLE IF NOT EXISTS queue_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  accounts_processed INTEGER DEFAULT 0,
  otps_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled'))
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_profile(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users_profile(id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON email_accounts(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_assigned ON email_accounts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_email_accounts_health ON email_accounts(health_score);
CREATE INDEX IF NOT EXISTS idx_mail_messages_account ON mail_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_mail_messages_received ON mail_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_messages_graph_id ON mail_messages(graph_message_id);
CREATE INDEX IF NOT EXISTS idx_otp_results_account ON otp_results(account_id);
CREATE INDEX IF NOT EXISTS idx_otp_results_status ON otp_results(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_status ON queue_sessions(status);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users_profile
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Users Profile policies
CREATE POLICY "users_read_own" ON users_profile FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "users_update_own" ON users_profile FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY "admin_insert_users" ON users_profile FOR INSERT WITH CHECK (is_admin() OR id = auth.uid());

-- Email Accounts policies
CREATE POLICY "admin_all_accounts" ON email_accounts FOR ALL USING (is_admin());
CREATE POLICY "employee_read_assigned" ON email_accounts FOR SELECT USING (assigned_to = auth.uid());

-- Mail Messages policies
CREATE POLICY "admin_all_messages" ON mail_messages FOR ALL USING (is_admin());
CREATE POLICY "employee_read_messages" ON mail_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM email_accounts WHERE id = mail_messages.account_id AND assigned_to = auth.uid()));

-- OTP Results policies
CREATE POLICY "admin_all_otps" ON otp_results FOR ALL USING (is_admin());
CREATE POLICY "employee_read_otps" ON otp_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM email_accounts WHERE id = otp_results.account_id AND assigned_to = auth.uid()));

-- Queue Sessions policies
CREATE POLICY "admin_all_queue" ON queue_sessions FOR ALL USING (is_admin());
CREATE POLICY "user_own_queue" ON queue_sessions FOR ALL USING (user_id = auth.uid());

-- Audit Logs policies
CREATE POLICY "admin_read_logs" ON audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "authenticated_insert_logs" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Tags policies
CREATE POLICY "authenticated_read_tags" ON tags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_tags" ON tags FOR ALL USING (is_admin());

-- Account Tags policies
CREATE POLICY "admin_manage_account_tags" ON account_tags FOR ALL USING (is_admin());
CREATE POLICY "authenticated_read_account_tags" ON account_tags FOR SELECT USING (auth.uid() IS NOT NULL);

-- Settings policies
CREATE POLICY "admin_manage_settings" ON settings FOR ALL USING (is_admin());
CREATE POLICY "authenticated_read_settings" ON settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profile (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE email_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE mail_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE otp_results;
ALTER PUBLICATION supabase_realtime ADD TABLE queue_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
