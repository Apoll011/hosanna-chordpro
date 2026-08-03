import { parseChordPro } from "../chordpro/parser";
import { Folder, GetSongsParams, ParsedSong, Song, SongsResponse } from "../types";
import { getApiClient } from "./http";

export function parseSong(apiSong: Song, folders: Folder[] = []): ParsedSong {
  const parsed = parseChordPro(apiSong.content || "");
  const songPath = apiSong.path || apiSong.id;
  const parts = songPath.split("/");
  const fileName = parts.pop() || "";
  const folder = apiSong.folderId
    ? folders.find((f) => f.id === apiSong.folderId)?.name || ""
    : "";
  const parsedTimestamp = Date.parse(apiSong.updatedAt);

  return {
    ...apiSong,
    id: songPath,
    remoteId: apiSong.id,
    remoteUpdatedAt: apiSong.updatedAt,
    title: apiSong.title || parsed.metadata.title || "Sem Título",
    subtitle: parsed.metadata.subtitle,
    artist: apiSong.artist || parsed.metadata.artist || "",
    composer: parsed.metadata.composer,
    copyright: parsed.metadata.copyright,
    album: parsed.metadata.album,
    key: parsed.metadata.key,
    tempo: parsed.metadata.tempo,
    capo: parsed.metadata.capo,
    songNumber: parsed.metadata.songNumber,
    comments: parsed.metadata.comments,
    folderId: apiSong.folderId,
    folder,
    fileName,
    content: apiSong.content,
    updatedAt: apiSong.updatedAt,
    parsedUpdatedAt: Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp,
    tags: apiSong.tags || [],
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
  ): Promise<{ songs: ParsedSong[]; total: number; page: number; totalPages: number }> => {
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

  renameSong: async (
    id: string,
    newTitle: string,
    updatedAt: string,
    newPath?: string,
  ): Promise<Song> => {
    return getApiClient().request<Song>(`/songs/${id}/rename`, {
      method: "PUT",
      body: JSON.stringify({ newTitle, newPath, updatedAt }),
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
