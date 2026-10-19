-- Love Fusion: phone OTP + pet-parent answer
-- Safe to run more than once (IF NOT EXISTS). Run this BEFORE uploading the code.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_pet_parent boolean;

CREATE TABLE IF NOT EXISTS phone_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  phone       varchar(20) NOT NULL,
  code_hash   varchar(64) NOT NULL,
  method      varchar(20) NOT NULL DEFAULT 'whatsapp',
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  token_hash  varchar(64),
  consumed_at timestamptz,
  ip_address  varchar(45),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps (phone, created_at);
CREATE INDEX IF NOT EXISTS idx_phone_otps_token_hash ON phone_otps (token_hash);
