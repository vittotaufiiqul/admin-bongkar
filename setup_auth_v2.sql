-- ============================================================
-- AUTH V2 — Login pakai ID + Password (bukan email)
-- Supabase Auth tetap dipakai di belakang layar
-- Email otomatis dibuat: {username}@adminbongkar.app
-- ============================================================
-- Jalankan di: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Tabel profil user
CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text NOT NULL UNIQUE,   -- ID login yang dipakai user
  nama        text NOT NULL,
  role        text NOT NULL DEFAULT 'picker',  -- 'admin' | 'picker'
  aktif       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- User bisa baca profilnya sendiri
CREATE POLICY "read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin bisa baca semua
CREATE POLICY "admin read all"
  ON user_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Admin bisa kelola semua user
CREATE POLICY "admin manage all"
  ON user_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 2. Auto-create profil saat user baru dibuat
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, username, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nama', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
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
-- BUAT AKUN ADMIN PERTAMA (ganti dengan data kamu):
--
-- 1. Jalankan di SQL Editor untuk daftarkan via service_role:
--
--    INSERT INTO auth.users (
--      id, email, encrypted_password,
--      email_confirmed_at, created_at, updated_at,
--      raw_user_meta_data
--    )
--    VALUES (
--      gen_random_uuid(),
--      'vitto@adminbongkar.app',
--      crypt('password123', gen_salt('bf')),
--      now(), now(), now(),
--      '{"username":"vitto","nama":"Vitto","role":"admin"}'::jsonb
--    );
--
-- ATAU pakai halaman Kelola User di dalam aplikasi admin.
-- ============================================================
