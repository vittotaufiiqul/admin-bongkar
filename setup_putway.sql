-- ============================================================
-- MIGRASI: Sistem Putway
-- Jalankan di: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Tambah kolom baru ke tabel permintaan
--    (info karung + keterangan tipe permintaan)
ALTER TABLE permintaan
  ADD COLUMN IF NOT EXISTS karung_nama    text,        -- nama/nomor karung
  ADD COLUMN IF NOT EXISTS karung_lokasi  text,        -- lokasi karung di gudang
  ADD COLUMN IF NOT EXISTS qty_per_karung integer DEFAULT 0,  -- pcs per karung
  ADD COLUMN IF NOT EXISTS jenis_permintaan text DEFAULT 'rak'; -- rak|sameday|sales|lainnya

-- 2. Tabel putway_tasks — satu baris per permintaan yang perlu diambil putway
--    Dibuat otomatis saat admin tambah permintaan, atau manual
CREATE TABLE IF NOT EXISTS putway_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link ke permintaan
  permintaan_id   uuid REFERENCES permintaan(id) ON DELETE CASCADE,

  -- Data barang (copy dari permintaan saat dibuat, agar tidak berubah)
  supplier        text NOT NULL,
  sku             text NOT NULL,
  nama            text,
  karung_nama     text,
  karung_lokasi   text,
  qty_per_karung  integer DEFAULT 0,
  qty_total       integer NOT NULL DEFAULT 0,  -- total qty yang diminta
  jenis_permintaan text DEFAULT 'rak',

  -- Diisi putway
  qty_ambil       integer DEFAULT 0,    -- berapa pcs yang diambil
  notes           text,                 -- catatan dari putway
  pic             text,                 -- nama putway yang mengambil
  selesai         boolean DEFAULT false,
  waktu_ambil     timestamptz,          -- timestamp saat checklist dicentang

  -- Meta
  tgl             text NOT NULL,        -- tanggal permintaan
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE putway_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all putway_tasks" ON putway_tasks FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_putway_tasks_tgl       ON putway_tasks (tgl);
CREATE INDEX IF NOT EXISTS idx_putway_tasks_selesai    ON putway_tasks (selesai);
CREATE INDEX IF NOT EXISTS idx_putway_tasks_perm_id   ON putway_tasks (permintaan_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE putway_tasks;
