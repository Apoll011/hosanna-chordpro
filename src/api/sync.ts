import { SyncStatusResponse } from "@hosanna/shared";
import { getApiClient } from "./http";

export const syncApi = {
  getStatus: async (): Promise<SyncStatusResponse> => {
    return getApiClient().request<SyncStatusResponse>("/sync/status");
  },
};
