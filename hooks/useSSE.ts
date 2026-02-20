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

    const connectRef = useRef<() => void>(() => { });

    const connect = useCallback(() => {
        if (!affiliateCode || affiliateCode.trim() === '') {
            console.log("SSE: No affiliate code, skipping connection");
            return;
        }

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        console.log("SSE: Connecting for", affiliateCode);
        const eventSource = new EventSource(`/api/sse/notifications?affiliate_code=${affiliateCode}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log("SSE: Connected");
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
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

        eventSource.onerror = (error) => {
            console.error("SSE: Error", error);
            setIsConnected(false);
            eventSource.close();

            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log("SSE: Reconnecting...");
                connectRef.current?.();
            }, 5000);
        };
    }, [affiliateCode, onPaymentReceived, onMessage]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect]);

    return {
        isConnected,
        lastNotification,
        reconnect: connect
    };
}
