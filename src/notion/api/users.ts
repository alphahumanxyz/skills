// Notion Users API
import type {
  GetUserResponse,
  ListUsersResponse,
} from '@notionhq/client/build/src/api-endpoints';

import { apiFetch } from './client';

export function getUser(userId: string): GetUserResponse {
  return apiFetch<GetUserResponse>(`/users/${userId}`);
}

export function listUsers(pageSize: number = 20): ListUsersResponse {
  return apiFetch<ListUsersResponse>(`/users?page_size=${pageSize}`);
}
