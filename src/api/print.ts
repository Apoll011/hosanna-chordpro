import { Templates, UpdateTemplateSettings } from "../types";
import { getApiClient } from "./http";

export const printApi = {
  printService: async (serviceId: string): Promise<string> => {
    return (
      await getApiClient().request_raw(`/print/services/${serviceId}`)
    ).text();
  },

  printSong: async (songId: string): Promise<string> => {
    return (await getApiClient().request_raw(`/print/songs/${songId}`)).text();
  },

  printFolder: async (folderId: string): Promise<string> => {
    return (
      await getApiClient().request_raw(`/print/folders/${folderId}`)
    ).text();
  },

  templates: async (): Promise<Templates> => {
    return getApiClient().request("/print/templates/");
  },

  setSettings: async (
    options: UpdateTemplateSettings,
  ): Promise<{ sucess: boolean }> => {
    return getApiClient().request(`/print/settings`, {
      method: "PUT",
      body: JSON.stringify(options),
    });
  },
};
