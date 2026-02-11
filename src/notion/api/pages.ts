// Notion Pages API
import type {
  CreatePageResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  UpdatePageResponse,
} from '@notionhq/client/build/src/api-endpoints';

import { apiFetch } from './client';

export function getPage(pageId: string): Promise<GetPageResponse> {
  return apiFetch<GetPageResponse>(`/pages/${pageId}`);
}

export function createPage(body: Record<string, unknown>): Promise<CreatePageResponse> {
  return apiFetch<CreatePageResponse>('/pages', { method: 'POST', body });
}

export function updatePage(
  pageId: string,
  body: Record<string, unknown>
): Promise<UpdatePageResponse> {
  return apiFetch<UpdatePageResponse>(`/pages/${pageId}`, { method: 'PATCH', body });
}

export function archivePage(pageId: string): Promise<UpdatePageResponse> {
  return apiFetch<UpdatePageResponse>(`/pages/${pageId}`, {
    method: 'PATCH',
    body: { archived: true },
  });
}

export function getPageContent(
  pageId: string,
  pageSize: number = 50
): Promise<ListBlockChildrenResponse> {
  return apiFetch<ListBlockChildrenResponse>(`/blocks/${pageId}/children?page_size=${pageSize}`);
}
