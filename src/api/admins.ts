import { AdminUser, CreateAdminParams } from "@hosanna/shared";
import { getApiClient } from "./http";

export const adminsApi = {
  getAdmins: async (): Promise<AdminUser[]> => {
    return getApiClient().request<AdminUser[]>("/tenants/admins");
  },

  getPendingAdmins: async (): Promise<AdminUser[]> => {
    return getApiClient().request<AdminUser[]>("/tenants/admins/pending");
  },

  createAdmin: async (params: CreateAdminParams): Promise<AdminUser> => {
    return getApiClient().request<AdminUser>("/tenants/admins", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  approveAdmin: async (
    id: string,
  ): Promise<{ message: string; user: AdminUser }> => {
    return getApiClient().request<{ message: string; user: AdminUser }>(
      `/tenants/admins/${id}/approve`,
      {
        method: "PUT",
      },
    );
  },

  removeAdmin: async (id: string): Promise<{ message: string }> => {
    return getApiClient().request<{ message: string }>(
      `/tenants/admins/${id}`,
      {
        method: "DELETE",
      },
    );
  },
};
