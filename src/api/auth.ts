import {
  EditTenantParams,
  LoginParams,
  LoginResponse,
  RegisterTenantParams,
  RegisterUserParams,
  Tenant,
  User,
} from "../types";
import { getApiClient } from "./http";

export const authApi = {
  login: async (credentials: LoginParams): Promise<LoginResponse> => {
    const data = await getApiClient().request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    getApiClient().setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  registerTenant: async (params: RegisterTenantParams): Promise<any> => {
    return getApiClient().request("/tenants/register", {
      method: "POST",
      body: JSON.stringify({
        tenantName: params.tenantName,
        tenantSlug: params.tenantSlug,
        adminName: params.adminName,
        adminEmail: params.adminEmail,
        adminPassword: params.adminPassword,
      }),
    });
  },

  editTenant: async (params: EditTenantParams): Promise<any> => {
    return getApiClient().request("/tenants/edit", {
      method: "PUT",
      body: JSON.stringify({
        logo: params.logo,
        name: params.name,
        active: params.active,
      }),
    });
  },

  getCurrentTenant: async (): Promise<Tenant> => {
    return getApiClient().request<Tenant>("/tenants/me");
  },

  registerUser: async (
    params: RegisterUserParams,
  ): Promise<{ message: string; isApproved: boolean; user: User }> => {
    return getApiClient().request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        tenantSlug: params.tenantSlug,
        name: params.name,
        email: params.email,
        password: params.password,
      }),
    });
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    return getApiClient().request<{ user: User }>("/auth/me");
  },

  logout: async (): Promise<void> => {
    try {
      await getApiClient().request("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    } finally {
      getApiClient().setTokens(null, null);
    }
  },
};
