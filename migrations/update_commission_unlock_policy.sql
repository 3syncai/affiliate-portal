-- Apply to the shared commerce database before deploying either application.
-- Existing credited/cancelled commissions are deliberately left untouched.
BEGIN;
ALTER TABLE affiliate_commission_log
  ADD COLUMN IF NOT EXISTS policy_hold_days integer,
  ADD COLUMN IF NOT EXISTS policy_delivered_at timestamptz;

-- Match vendor policy: deepest assigned category, nearest configured ancestor,
-- max(return, replacement) per product, then the longest product hold per order.
CREATE OR REPLACE FUNCTION resolve_commission_hold_days(target_order_id text)
RETURNS integer LANGUAGE plpgsql STABLE AS $$
DECLARE hold_days integer;
BEGIN
  IF to_regclass('public.category_return_policy') IS NULL THEN RETURN 7; END IF;
  WITH RECURSIVE products AS (
    SELECT DISTINCT COALESCE(li.product_id, pv.product_id) AS id
    FROM order_item oi
    JOIN order_line_item li ON li.id = oi.item_id
    LEFT JOIN product_variant pv ON pv.id = li.variant_id
    WHERE oi.order_id = target_order_id
  ), ancestors AS (
    SELECT p.id AS product_id, c.id AS assigned_id, c.id, c.parent_category_id,
           0 AS distance, ARRAY[c.id::text] AS path
    FROM products p
    JOIN product_category_product pcp ON pcp.product_id = p.id
    JOIN product_category c ON c.id = pcp.product_category_id
    UNION ALL
    SELECT a.product_id, a.assigned_id, c.id, c.parent_category_id,
           a.distance + 1, a.path || c.id::text
    FROM ancestors a JOIN product_category c ON c.id = a.parent_category_id
    WHERE NOT c.id::text = ANY(a.path)
  ), ranked AS (
    SELECT a.*, MAX(distance) OVER (PARTITION BY product_id, assigned_id) AS depth
    FROM ancestors a
  )
  SELECT MAX(COALESCE((
    SELECT GREATEST(policy.return_window_days, policy.replacement_window_days)
    FROM ranked a JOIN category_return_policy policy ON policy.category_id = a.id
    WHERE a.product_id = p.id
    ORDER BY a.depth DESC, a.assigned_id, a.distance
    LIMIT 1
  ), 7)) INTO hold_days FROM products p;
  RETURN COALESCE(hold_days, 7);
END;
$$;

CREATE OR REPLACE FUNCTION resolve_commission_delivered_at(target_order_id text)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT MAX(f.delivered_at) FROM order_fulfillment ofl
     JOIN fulfillment f ON f.id = ofl.fulfillment_id
     WHERE ofl.order_id = target_order_id AND f.canceled_at IS NULL),
    (SELECT NULLIF(o.metadata->>'shiprocket_delivered_at', '')::timestamptz
     FROM "order" o WHERE o.id = target_order_id)
  );
$$;

CREATE OR REPLACE FUNCTION enforce_commission_unlock_delay()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Do not retroactively debit or re-credit already settled commissions.
  IF TG_OP = 'UPDATE' AND OLD.status = 'CREDITED' THEN RETURN NEW; END IF;
  IF NEW.status IN ('PENDING', 'CREDITED') THEN
    IF NEW.policy_hold_days IS NULL THEN
      NEW.policy_delivered_at := resolve_commission_delivered_at(NEW.order_id);
      IF NEW.policy_delivered_at IS NOT NULL THEN
        NEW.policy_hold_days := resolve_commission_hold_days(NEW.order_id);
      END IF;
    END IF;
    IF NEW.policy_hold_days IS NOT NULL AND NEW.policy_delivered_at IS NOT NULL THEN
      NEW.unlock_at := NEW.policy_delivered_at + NEW.policy_hold_days * INTERVAL '1 day';
    ELSE
      NEW.unlock_at := NULL;
    END IF;
    IF NEW.status = 'CREDITED' AND (NEW.unlock_at IS NULL OR NEW.unlock_at > NOW()) THEN
      NEW.status := 'PENDING';
      NEW.credited_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_commission_unlock_delay_trigger ON affiliate_commission_log;
CREATE TRIGGER enforce_commission_unlock_delay_trigger
  BEFORE INSERT OR UPDATE ON affiliate_commission_log
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_unlock_delay();

-- Upgrade old five-minute/fixed-day pending timers once, anchored to delivery.
-- The trigger resolves the current policy and freezes it for each pending row.
UPDATE affiliate_commission_log SET unlock_at = NULL
WHERE status = 'PENDING' AND policy_hold_days IS NULL;
COMMIT;
