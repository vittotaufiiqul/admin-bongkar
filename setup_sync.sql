-- ============================================================
-- MIGRASI: Kolom tambahan master_sku dari spreadsheet
-- Jalankan di: Supabase → SQL Editor → Run
-- ============================================================

ALTER TABLE master_sku
  ADD COLUMN IF NOT EXISTS jumlah_sku_di_rak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode            text,
  ADD COLUMN IF NOT EXISTS model              text,
  ADD COLUMN IF NOT EXISTS motif              text,
  ADD COLUMN IF NOT EXISTS warna              text,
  ADD COLUMN IF NOT EXISTS size               text,
  ADD COLUMN IF NOT EXISTS jenis_rak          text,
  ADD COLUMN IF NOT EXISTS jenis_deadstock    text,
  ADD COLUMN IF NOT EXISTS rak_baru           text,
  ADD COLUMN IF NOT EXISTS ganti_rak          text,
  ADD COLUMN IF NOT EXISTS baris              text,
  ADD COLUMN IF NOT EXISTS kolom              text;

-- Index untuk barcode (sering dicari)
CREATE INDEX IF NOT EXISTS idx_master_sku_barcode ON master_sku (barcode);
