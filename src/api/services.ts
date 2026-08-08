import { Service, ServiceElement } from "../types";
import { getApiClient } from "./http";

export const servicesApi = {
  getServices: async (archived = false): Promise<Service[]> => {
    return getApiClient().request<Service[]>(`/services?archived=${archived}`);
  },

  getServiceById: async (id: string): Promise<Service> => {
    return getApiClient().request<Service>(`/services/${id}`);
  },

  createService: async (data: Partial<Service>): Promise<Service> => {
    return getApiClient().request<Service>("/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateService: async (
    id: string,
    data: Partial<Service>,
  ): Promise<Service> => {
    return getApiClient().request<Service>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteService: async (id: string): Promise<void> => {
    return getApiClient().request<void>(`/services/${id}`, {
      method: "DELETE",
    });
  },

  updateServiceElements: async (
    serviceId: string,
    data: { elements: ServiceElement[]; updatedAt: string },
  ): Promise<Service> => {
    return getApiClient().request<Service>(`/services/${serviceId}/elements`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
