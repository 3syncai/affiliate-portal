"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface SSENotification {
    type: string;
    message: string;
    amount?: number;
    transactionId?: string;
    timestamp?: string;
}

interface UseSSEOptions {
    affiliateCode: string;
    onPaymentReceived?: (data: SSENotification) => void;
    onMessage?: (data: SSENotification) => void;
}

export function useSSE({ affiliateCode, onPaymentReceived, onMessage }: UseSSEOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastNotification, setLastNotification] = useState<SSENotification | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const activeRef = useRef(false);

    const connect = useCallback(function connectStream() {
        if (!activeRef.current) return;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Detach callbacks before closing so an obsolete stream cannot reconnect.
        if (eventSourceRef.current) {
            eventSourceRef.current.onopen = null;
            eventSourceRef.current.onmessage = null;
            eventSourceRef.current.onerror = null;
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        if (!affiliateCode || affiliateCode.trim() === '') {
            console.log("SSE: No affiliate code, skipping connection");
            return;
        }

        console.log("SSE: Connecting for", affiliateCode);
        const eventSource = new EventSource(`/api/sse/notifications?affiliate_code=${encodeURIComponent(affiliateCode)}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            if (!activeRef.current || eventSourceRef.current !== eventSource) return;
            console.log("SSE: Connected");
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            if (!activeRef.current || eventSourceRef.current !== eventSource) return;
            try {
                const data: SSENotification = JSON.parse(event.data);
                console.log("SSE: Received", data);
                setLastNotification(data);

                // Call appropriate callback
                if (data.type === "payment_received" && onPaymentReceived) {
                    onPaymentReceived(data);
                }
                if (onMessage) {
                    onMessage(data);
                }
            } catch (error) {
                console.error("SSE: Parse error", error);
            }
        };

        eventSource.onerror = () => {
            if (!activeRef.current || eventSourceRef.current !== eventSource) return;
            // EventSource errors contain no HTTP status or useful error details.
            // A dropped stream is recoverable and should not trigger the dev overlay.
            console.warn("SSE: Connection interrupted; retrying in 5 seconds.");
            setIsConnected(false);
            eventSource.onopen = null;
            eventSource.onmessage = null;
            eventSource.onerror = null;
            eventSource.close();
            eventSourceRef.current = null;

            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                console.log("SSE: Reconnecting...");
                connectStream();
            }, 5000);
        };
    }, [affiliateCode, onPaymentReceived, onMessage]);

    useEffect(() => {
        activeRef.current = true;
        connect();

        return () => {
            activeRef.current = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.onopen = null;
                eventSourceRef.current.onmessage = null;
                eventSourceRef.current.onerror = null;
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [connect]);

    return {
        isConnected,
        lastNotification,
        reconnect: connect
    };
}
