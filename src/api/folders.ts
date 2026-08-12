import { Folder, FoldersResponse } from "../types";
import { getApiClient } from "./http";

export const foldersApi = {
  getFolders: async (): Promise<FoldersResponse> => {
    return getApiClient().request<FoldersResponse>("/folders");
  },

  getFlatFolders: async (): Promise<Folder[]> => {
    return getApiClient().request<Folder[]>("/folders/flat");
  },

  createFolder: async (
    name: string,
    parentId?: string | null,
  ): Promise<Folder> => {
    return getApiClient().request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    });
  },

  updateFolder: async (
    id: string,
    data: { name?: string; parentId?: string | null; updatedAt: string },
  ): Promise<Folder> => {
    return getApiClient().request<Folder>(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  renameFolder: async (
    id: string,
    name: string,
    updatedAt: string,
  ): Promise<Folder> => {
    return getApiClient().request<Folder>(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, updatedAt }),
    });
  },

  moveFolder: async (
    id: string,
    parentId: string | null,
    updatedAt: string,
  ): Promise<Folder> => {
    return getApiClient().request<Folder>(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ parentId, updatedAt }),
    });
  },

  deleteFolder: async (
    id: string,
    action: "delete_songs" | "move_to_root",
  ): Promise<void> => {
    return getApiClient().request<void>(`/folders/${id}?action=${action}`, {
      method: "DELETE",
    });
  },

  deleteFolderAndSongs: async (
    id: string,
  ): Promise<{ deletedSongs: number }> => {
    return getApiClient().request<{ deletedSongs: number }>(
      `/folders/${id}/with-content`,
      {
        method: "DELETE",
      },
    );
  },

  deleteFolderAndMoveSongsToRoot: async (
    id: string,
  ): Promise<{ movedSongs: number }> => {
    return getApiClient().request<{ movedSongs: number }>(
      `/folders/${id}/move-content-to-root`,
      {
        method: "DELETE",
      },
    );
  },

  moveSongsInFolder: async (id: string, songIds: string[]): Promise<void> => {
    return getApiClient().request<void>(`/folders/${id}/songs`, {
      method: "PUT",
      body: JSON.stringify({ songIds }),
    });
  },
};
