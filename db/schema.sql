-- 1. Point-in-time staking & capture snapshots (perishable upstream data)
CREATE TABLE IF NOT EXISTS transformation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dungeon_address TEXT NOT NULL,
  cap INT NOT NULL,
  max_period INT NOT NULL,
  claimed INT NOT NULL,
  held INT NOT NULL,
  staked INT NOT NULL,
  unsafe_staked INT NOT NULL,
  taken INT NOT NULL,
  power_form_count INT NOT NULL,
  evolved_count INT NOT NULL,
  totals_json JSONB NOT NULL,
  species_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transformation_snapshots_captured_at
  ON transformation_snapshots (captured_at DESC);

-- 2. Master Loot Dungeon Beast catalog (species 78-107, genesis=false)
CREATE TABLE IF NOT EXISTS beasts (
  token_id TEXT PRIMARY KEY,
  beast_id INT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  tier SMALLINT NOT NULL,
  prefix_name TEXT,
  suffix_name TEXT,
  level INT NOT NULL,
  health INT NOT NULL,
  power INT NOT NULL,
  projected_rank INT,
  adventurers_killed INT NOT NULL DEFAULT 0,
  visual_effects INT NOT NULL DEFAULT 0,
  card_grade SMALLINT,
  card_condition JSONB,
  minted_at_block BIGINT NOT NULL,
  minted_at_minute BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'staked',
      'sold_regular',
      'sold_power_form',
      'held_power_form',
      'held_regular',
      'superseded'
    )
  ),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE beasts DROP CONSTRAINT IF EXISTS beasts_status_check;
ALTER TABLE beasts ADD CONSTRAINT beasts_status_check CHECK (
  status IN (
    'staked',
    'sold_regular',
    'sold_power_form',
    'held_power_form',
    'held_regular',
    'superseded'
  )
);

CREATE INDEX IF NOT EXISTS idx_beasts_status ON beasts (status);
CREATE INDEX IF NOT EXISTS idx_beasts_tier_grade ON beasts (tier, card_grade);
CREATE INDEX IF NOT EXISTS idx_beasts_minted_block ON beasts (minted_at_block DESC);

-- 3. Lifecycle transition audit log
CREATE TABLE IF NOT EXISTS beast_status_changes (
  id BIGSERIAL PRIMARY KEY,
  token_id TEXT NOT NULL REFERENCES beasts(token_id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beast_status_changes_token
  ON beast_status_changes (token_id, detected_at DESC);

-- 4. Buyback pool seed & sale events (10 Tier x Form Sudoswap ETH pools)
CREATE TABLE IF NOT EXISTS pool_events (
  pool_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  tx INT NOT NULL,
  tier SMALLINT NOT NULL,
  form TEXT NOT NULL CHECK (form IN ('regular', 'power_form')),
  block BIGINT NOT NULL,
  event_time BIGINT NOT NULL,
  kind TEXT NOT NULL,
  spot_price_wei NUMERIC(78, 0) NOT NULL,
  delta NUMERIC(78, 0),
  amount_wei NUMERIC(78, 0),
  nft_count INT,
  protocol_fee_wei NUMERIC(78, 0),
  fee_wei NUMERIC(78, 0),
  PRIMARY KEY (pool_address, transaction_hash, tx)
);

CREATE INDEX IF NOT EXISTS idx_pool_events_time ON pool_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_pool_events_tier_form ON pool_events (tier, form);

-- 5. Collector execution log (for monitoring & "Last synced" UI badge)
CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  beasts_synced INT NOT NULL DEFAULT 0,
  status_changes INT NOT NULL DEFAULT 0,
  pool_events_upserted INT NOT NULL DEFAULT 0,
  error_message TEXT
);