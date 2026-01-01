-- Notifications table for admin payment alerts and system notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient Information
    recipient_id VARCHAR(255) NOT NULL,
    recipient_role VARCHAR(50) NOT NULL CHECK (recipient_role IN ('branch', 'asm', 'state', 'admin')),
    
    -- Sender Information
    sender_id VARCHAR(255),
    sender_role VARCHAR(50),
    
    -- Notification Content
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general' CHECK (type IN ('payment', 'general', 'alert', 'system')),
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, recipient_role);
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Stores notifications for all admin roles including payment alerts';
COMMENT ON COLUMN notifications.recipient_role IS 'Role of the admin receiving notification: branch, asm, state, or admin';
COMMENT ON COLUMN notifications.type IS 'Type of notification: payment, general, alert, or system';
