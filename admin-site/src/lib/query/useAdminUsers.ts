"use client";

import { useQuery } from "@tanstack/react-query";
import { getUser, listUsers, type AdminUser } from "@/lib/api/users";
import type { Page } from "@/lib/api/client";

export const adminUserKeys = {
    all: ["admin", "users"] as const,
    list: (page: number, q: string) => [...adminUserKeys.all, "list", page, q] as const,
    detail: (id: number) => [...adminUserKeys.all, "detail", id] as const,
};

export function useAdminUsers(page: number, q: string) {
    return useQuery<Page<AdminUser>>({
        queryKey: adminUserKeys.list(page, q),
        queryFn: () => listUsers(page, 20, q),
    });
}

export function useAdminUser(id: number) {
    return useQuery<AdminUser>({
        queryKey: adminUserKeys.detail(id),
        queryFn: () => getUser(id),
        enabled: Number.isFinite(id) && id > 0,
    });
}
