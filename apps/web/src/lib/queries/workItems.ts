import type {
  WorkItem,
  WorkItemCreate,
  WorkItemKind,
  WorkItemListQuery,
  WorkItemUpdate,
} from '@centralit/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { api } from '../api';

export interface WorkItemListResponse {
  items: WorkItem[];
  total: number;
  limit: number;
  offset: number;
}

export const workItemKeys = {
  all: ['work-items'] as const,
  list: (filters: Partial<WorkItemListQuery>) =>
    [...workItemKeys.all, 'list', filters] as const,
  detail: (id: string) => [...workItemKeys.all, 'detail', id] as const,
};

function cleanFilters(filters: Partial<WorkItemListQuery>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function useWorkItems(filters: Partial<WorkItemListQuery>) {
  return useQuery({
    queryKey: workItemKeys.list(filters),
    queryFn: async () => {
      const { data } = await api.get<WorkItemListResponse>('/work-items', {
        params: cleanFilters(filters),
      });
      return data;
    },
  });
}

export function useWorkItem(id: string | undefined) {
  return useQuery({
    queryKey: workItemKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<WorkItem>(`/work-items/${id}`);
      return data;
    },
  });
}

export function useCreateWorkItem(_projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkItemCreate) => {
      const { data } = await api.post<WorkItem>('/work-items', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.all });
    },
  });
}

interface PatchContext {
  previousLists: Array<[QueryKey, WorkItemListResponse | undefined]>;
  previousDetail: WorkItem | undefined;
}

export function useUpdateWorkItem() {
  const qc = useQueryClient();
  return useMutation<WorkItem, Error, { id: string; patch: WorkItemUpdate }, PatchContext>({
    mutationFn: async ({ id, patch }) => {
      const { data } = await api.patch<WorkItem>(`/work-items/${id}`, patch);
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: workItemKeys.all });
      const previousDetail = qc.getQueryData<WorkItem>(workItemKeys.detail(id));
      const previousLists = qc.getQueriesData<WorkItemListResponse>({
        queryKey: [...workItemKeys.all, 'list'],
      });
      qc.setQueriesData<WorkItemListResponse>(
        { queryKey: [...workItemKeys.all, 'list'] },
        (data) => {
          if (!data) return data;
          return {
            ...data,
            items: data.items.map((it) =>
              it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it,
            ),
          };
        },
      );
      if (previousDetail) {
        qc.setQueryData<WorkItem>(workItemKeys.detail(id), {
          ...previousDetail,
          ...patch,
          updatedAt: new Date().toISOString(),
        });
      }
      return { previousLists, previousDetail };
    },
    onError: (_err, { id }, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previousLists) {
        qc.setQueryData(key, data);
      }
      if (ctx.previousDetail) {
        qc.setQueryData(workItemKeys.detail(id), ctx.previousDetail);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.all });
    },
  });
}

export function useMoveWorkItem() {
  const qc = useQueryClient();
  return useMutation<
    WorkItem,
    Error,
    { id: string; parentId: string | null },
    PatchContext
  >({
    mutationFn: async ({ id, parentId }) => {
      const { data } = await api.post<WorkItem>(`/work-items/${id}/move`, { parentId });
      return data;
    },
    onMutate: async ({ id, parentId }) => {
      await qc.cancelQueries({ queryKey: workItemKeys.all });
      const previousDetail = qc.getQueryData<WorkItem>(workItemKeys.detail(id));
      const previousLists = qc.getQueriesData<WorkItemListResponse>({
        queryKey: [...workItemKeys.all, 'list'],
      });
      qc.setQueriesData<WorkItemListResponse>(
        { queryKey: [...workItemKeys.all, 'list'] },
        (data) => {
          if (!data) return data;
          return {
            ...data,
            items: data.items.map((it) =>
              it.id === id ? { ...it, parentId } : it,
            ),
          };
        },
      );
      return { previousLists, previousDetail };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previousLists) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.all });
    },
  });
}

export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work-items/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workItemKeys.all }),
  });
}

export const KIND_LABEL: Record<WorkItemKind, string> = {
  epic: 'Epic',
  feature: 'Feature',
  story: 'Story',
  task: 'Task',
};
