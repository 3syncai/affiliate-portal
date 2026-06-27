-- Migration: Enforce the 7-day post-delivery delay before a commission
-- becomes CREDITED, no matter which application code path performs the write.

CREATE OR REPLACE FUNCTION enforce_commission_unlock_delay()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status = 'CREDITED') THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'CREDITED' THEN
        IF NEW.unlock_at IS NULL THEN
            NEW.unlock_at := NOW() + INTERVAL '7 days';
            NEW.status := 'PENDING';
            NEW.credited_at := NULL;
        ELSIF NEW.unlock_at > NOW() THEN
            NEW.status := 'PENDING';
            NEW.credited_at := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_commission_unlock_delay_trigger
    ON affiliate_commission_log;

CREATE TRIGGER enforce_commission_unlock_delay_trigger
    BEFORE INSERT OR UPDATE ON affiliate_commission_log
    FOR EACH ROW
    EXECUTE FUNCTION enforce_commission_unlock_delay();
