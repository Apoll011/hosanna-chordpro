import { ServerSettings } from "@hosanna/shared";
import { getApiClient } from "./http";

export const settingsApi = {
  getSettings: async (): Promise<ServerSettings> => {
    return getApiClient().request<ServerSettings>("/settings");
  },

  updateSettings: async (
    settings: Partial<ServerSettings>,
  ): Promise<ServerSettings> => {
    return getApiClient().request<ServerSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  downloadBackup: async (): Promise<void> => {
    const res = await fetch(`${getApiClient().getBaseURL()}/backup`, {
      headers: {
        Authorization: `Bearer ${getApiClient().getToken()}`,
      },
    });
    if (!res.ok) throw new Error("Failed to export backup");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hosanna_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  restoreBackup: async (
    backupData: any,
  ): Promise<{ message: string; counts: Record<string, number> }> => {
    return getApiClient().request<{
      message: string;
      counts: Record<string, number>;
    }>("/backup/restore", {
      method: "POST",
      body: JSON.stringify(backupData),
    });
  },

  getHealth: async (): Promise<{ status: string; timestamp: string }> => {
    return getApiClient().request<{ status: string; timestamp: string }>(
      "/health",
    );
  },
};
