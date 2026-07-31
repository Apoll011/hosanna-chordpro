import { SyncStatusResponse } from "../types";
import { getApiClient } from "./http";

export const syncApi = {
  getStatus: async (): Promise<SyncStatusResponse> => {
    return getApiClient().request<SyncStatusResponse>("/sync/status");
  },
};
