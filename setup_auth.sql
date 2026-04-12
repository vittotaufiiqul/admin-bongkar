-- ============================================================
-- AUTH SYSTEM — Admin Bongkar
-- Jalankan di: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Tabel profil user (linked ke auth.users Supabase)
CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama        text NOT NULL,
  role        text NOT NULL DEFAULT 'picker',  -- 'admin' | 'picker'
  aktif       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Semua user yang login bisa baca profil sendiri
CREATE POLICY "read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin bisa baca semua profil
CREATE POLICY "admin read all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin bisa insert/update/delete profil
CREATE POLICY "admin manage all profiles"
  ON user_profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Auto-create profil saat user baru didaftarkan
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'picker')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SETELAH JALANKAN SQL INI:
-- 1. Buka Supabase → Authentication → Users → Invite User
--    atau gunakan halaman "Kelola User" di tab Admin
-- 2. Set role admin dengan:
--    UPDATE user_profiles
--    SET role = 'admin', nama = 'Vitto'
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'email@anda.com');
-- ============================================================
