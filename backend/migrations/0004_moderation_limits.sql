-- Enforce the duration policy on existing restrictions:
--   timeout  -> max 1 week (168h)
--   soft ban -> max 1 year (8760h)
--   ban / IP ban -> permanent, no expiry.
-- Active soft bans without an expiry are capped to one year from creation.
UPDATE moderation
SET expires_at = created_at + 31536000000
WHERE type = 'soft_ban' AND status IN ('active', 'pending') AND expires_at IS NULL;

-- Any legacy timeout longer than a week is pulled back to one week.
UPDATE moderation
SET expires_at = created_at + 604800000
WHERE type = 'timeout' AND status IN ('active', 'pending')
  AND (expires_at IS NULL OR expires_at > created_at + 604800000);
