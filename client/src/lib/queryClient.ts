import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Get the admin key from localStorage, or null if not present
export function getAdminKey(): string | null {
  return localStorage.getItem('adminKey');
}

// Set the admin key in localStorage
export function setAdminKey(key: string): void {
  localStorage.setItem('adminKey', key);
}

// Clear the admin key from localStorage
export function clearAdminKey(): void {
  localStorage.removeItem('adminKey');
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  isAdmin: boolean = false,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Add Content-Type header if we have data
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add admin key header if this is an admin request and we have a key
  if (isAdmin) {
    const adminKey = getAdminKey();
    if (adminKey) {
      headers["x-admin-key"] = adminKey;
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchOnWindowFocus: true,
      staleTime: 15000, // 15 seconds stale time for more frequent updates
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
