export const clients = new Map<string, ReadableStreamDefaultController>();

export function sendNotification(affiliateCode: string, data: unknown) {
    const controller = clients.get(affiliateCode);
    if (controller) {
        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
            console.log(`SSE: Notification sent to ${affiliateCode}`);
        } catch (error) {
            console.error("SSE send error:", error);
            clients.delete(affiliateCode);
        }
    }
}
