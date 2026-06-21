"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createAnnouncement,
    deleteAnnouncement,
    listAdminAnnouncements,
    updateAnnouncement,
    type AdminAnnouncement,
    type AnnouncementInput,
} from "@/lib/api/announcements";
import type { Page } from "@/lib/api/client";

export const adminAnnouncementKeys = {
    all: ["admin", "announcements"] as const,
    list: () => [...adminAnnouncementKeys.all, "list"] as const,
};

export function useAdminAnnouncements() {
    return useQuery<Page<AdminAnnouncement>>({
        queryKey: adminAnnouncementKeys.list(),
        queryFn: () => listAdminAnnouncements(0, 50),
    });
}

export function useCreateAnnouncement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: adminAnnouncementKeys.all }),
    });
}

export function useUpdateAnnouncement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: AnnouncementInput }) => updateAnnouncement(id, input),
        onSuccess: () => qc.invalidateQueries({ queryKey: adminAnnouncementKeys.all }),
    });
}

export function useDeleteAnnouncement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteAnnouncement(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: adminAnnouncementKeys.all }),
    });
}
