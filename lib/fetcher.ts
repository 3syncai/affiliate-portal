import axios from 'axios';

/**
 * Generic fetcher utility for axios requests with automatic auth token handling.
 * Used primarily with SWR for client-side data fetching.
 */
export const fetcher = async <T = unknown>(url: string): Promise<T> => {
    // SSR Safety: Ensure code only runs on client
    if (typeof window === 'undefined') {
        throw new Error("Cannot fetch on server-side using this utility");
    }

    const token = localStorage.getItem("affiliate_token");

    if (!token) {
        throw new Error("Authentication required");
    }

    try {
        const response = await axios.get<T>(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const message = error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "An unexpected error occurred during the request";
            throw new Error(message);
        }

        throw error instanceof Error ? error : new Error("An unknown error occurred");
    }
};
