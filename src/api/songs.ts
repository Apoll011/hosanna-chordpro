import { parseChordPro } from "../chordpro/parser";
import {
  Folder,
  GetSongsParams,
  ParsedSong,
  Song,
  SongsResponse,
} from "../types";
import { getApiClient } from "./http";

export function parseSong(apiSong: Song, folders: Folder[] = []): ParsedSong {
  const parsed = parseChordPro(apiSong.content || "");
  const songPath = apiSong.path || "";
  const parts = songPath.split("/").filter(Boolean);
  const fileName =
    parts.length > 0
      ? parts[parts.length - 1]
      : apiSong.title
        ? `${apiSong.title.replace(/[\/\\]/g, "_")}.chopro`
        : "song.chopro";
  const folder = apiSong.folderId
    ? folders.find((f) => f.id === apiSong.folderId)?.name || ""
    : parts.length > 1
      ? parts.slice(0, -1).join("/")
      : "";

  return {
    ...apiSong,
    title: apiSong.title || parsed.metadata.title || "Sem Título",
    artist: apiSong.artist || parsed.metadata.artist || "",
    folder,
    fileName,
    metadata: parsed.metadata,
  };
}

export const songsApi = {
  getSongs: async (params: GetSongsParams = {}): Promise<SongsResponse> => {
    const queryParts: string[] = [];
    if (params.search)
      queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.folder)
      queryParts.push(`folder=${encodeURIComponent(params.folder)}`);
    if (params.sortBy)
      queryParts.push(`sortBy=${encodeURIComponent(params.sortBy)}`);
    if (params.sortOrder)
      queryParts.push(`sortOrder=${encodeURIComponent(params.sortOrder)}`);
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.limit) queryParts.push(`limit=${params.limit}`);
    if (params.key) queryParts.push(`key=${encodeURIComponent(params.key)}`);
    if (params.tag) queryParts.push(`tag=${encodeURIComponent(params.tag)}`);
    if (params.searchFields) {
      queryParts.push(
        `searchFields=${encodeURIComponent(JSON.stringify(params.searchFields))}`,
      );
    }

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return getApiClient().request<SongsResponse>(`/songs${queryString}`);
  },

  getParsedSongs: async (
    params: GetSongsParams = {},
    folders: Folder[] = [],
  ): Promise<{
    songs: ParsedSong[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const res = await songsApi.getSongs(params);
    return {
      ...res,
      songs: res.songs.map((song) => parseSong(song, folders)),
    };
  },

  getSongById: async (id: string): Promise<Song> => {
    return getApiClient().request<Song>(`/songs/${id}`);
  },

  getParsedSongById: async (
    id: string,
    folders: Folder[] = [],
  ): Promise<ParsedSong> => {
    const song = await songsApi.getSongById(id);
    return parseSong(song, folders);
  },

  createSong: async (data: Partial<Song>): Promise<Song> => {
    return getApiClient().request<Song>("/songs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  createSongsBatch: async (
    songsList: Array<Partial<Song>>,
  ): Promise<{ created: Song[]; count: number }> => {
    return getApiClient().request<{ created: Song[]; count: number }>(
      "/songs/batch",
      {
        method: "POST",
        body: JSON.stringify({ songs: songsList }),
      },
    );
  },

  updateSong: async (id: string, data: Partial<Song>): Promise<Song> => {
    return getApiClient().request<Song>(`/songs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteSong: async (id: string): Promise<void> => {
    return getApiClient().request<void>(`/songs/${id}`, {
      method: "DELETE",
    });
  },

  moveSong: async (
    id: string,
    folderId: string | null,
    updatedAt: string,
    newPath?: string,
  ): Promise<Song> => {
    return getApiClient().request<Song>(`/songs/${id}/move`, {
      method: "PUT",
      body: JSON.stringify({ folderId, newPath, updatedAt }),
    });
  },

  downloadSong: async (id: string, filename: string): Promise<void> => {
    const res = await fetch(
      `${getApiClient().getBaseURL()}/songs/${id}/download`,
      {
        headers: {
          Authorization: `Bearer ${getApiClient().getToken()}`,
        },
      },
    );
    if (!res.ok) throw new Error("Failed to download song");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pro") ? filename : `${filename}.pro`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  updateBatchTags: async (params: {
    songIds: string[];
    tags: string[];
    mode?: "append" | "replace" | "remove";
  }): Promise<{ success: boolean; count: number }> => {
    return getApiClient().request<{ success: boolean; count: number }>(
      "/songs/batch-tags",
      {
        method: "PUT",
        body: JSON.stringify(params),
      },
    );
  },
};
