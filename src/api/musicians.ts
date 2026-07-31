import { MusicianToken } from "../types";
import { getApiClient } from "./http";

export interface CreateMusicianTokenParams {
  name: string;
  expiresAt?: string;
  allowedServices?: string[];
}

export const musiciansApi = {
  getTokens: async (): Promise<MusicianToken[]> => {
    return getApiClient().request<MusicianToken[]>("/musicians/tokens");
  },

  createToken: async (
    params: CreateMusicianTokenParams,
  ): Promise<
    MusicianToken & { token: string; accessUrl: string; qrCode: string }
  > => {
    return getApiClient().request<
      MusicianToken & { token: string; accessUrl: string; qrCode: string }
    >("/musicians/tokens", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  getTokenById: async (id: string): Promise<MusicianToken> => {
    return getApiClient().request<MusicianToken>(`/musicians/tokens/${id}`);
  },

  updateToken: async (
    id: string,
    data: {
      name?: string;
      expiresAt?: string;
      allowedServices?: string[];
      updatedAt: string;
    },
  ): Promise<MusicianToken> => {
    return getApiClient().request<MusicianToken>(`/musicians/tokens/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  regenerateToken: async (
    id: string,
    updatedAt: string,
  ): Promise<
    MusicianToken & { token: string; accessUrl: string; qrCode: string }
  > => {
    return getApiClient().request<
      MusicianToken & { token: string; accessUrl: string; qrCode: string }
    >(`/musicians/tokens/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ updatedAt }),
    });
  },

  revokeToken: async (
    id: string,
    updatedAt: string,
  ): Promise<MusicianToken> => {
    return getApiClient().request<MusicianToken>(`/musicians/tokens/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ updatedAt }),
    });
  },

  deleteTokenPermanently: async (id: string): Promise<void> => {
    return getApiClient().request<void>(`/musicians/tokens/${id}/permanent`, {
      method: "DELETE",
    });
  },
};
