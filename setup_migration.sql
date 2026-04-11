-- ============================================================
-- MIGRASI: Sistem Kapasitas Rak & Lebihan Area
-- Jalankan di Supabase → SQL Editor → Run
-- ============================================================

-- 1. Tambah kapasitas_rak ke master_sku
ALTER TABLE master_sku
  ADD COLUMN IF NOT EXISTS kapasitas_rak integer DEFAULT 0;

-- 2. Tambah qty_lebihan ke scan_masuk
ALTER TABLE scan_masuk
  ADD COLUMN IF NOT EXISTS qty_lebihan integer DEFAULT 0;

-- 3. Tabel pindah_rak: catat pemindahan barang dari lebihan ke rak
CREATE TABLE IF NOT EXISTS pindah_rak (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier    text NOT NULL,
  sku         text NOT NULL,
  nama        text,
  rak         text,
  qty_pindah  integer NOT NULL DEFAULT 0,
  catatan     text,
  tgl         text NOT NULL,
  wkt         text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE pindah_rak ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all pindah_rak" ON pindah_rak FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pindah_rak_sku ON pindah_rak (sku);
CREATE INDEX IF NOT EXISTS idx_pindah_rak_tgl ON pindah_rak (tgl);
