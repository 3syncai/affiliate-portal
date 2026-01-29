import axios from 'axios';

// Generic fetcher for better type safety
export const fetcher = async <T = any>(url: string): Promise<T> => {
    // 1. SSR Safety: Ensure code only runs on client
    if (typeof window === 'undefined') {
        return Promise.reject("Cannot fetch on server");
    }

    const token = localStorage.getItem("affiliate_token");

    if (!token) {
        throw new Error("No auth token found");
    }

    try {
        const response = await axios.get<T>(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error: any) {
        // 2. Production Error Handling: Return clean error message
        const message = error.response?.data?.message || error.response?.data?.error || error.message || "An error occurred";
        throw new Error(message);
    }
};
