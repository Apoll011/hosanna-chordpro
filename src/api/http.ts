import { ApiClient } from "./client";

let httpClient: ApiClient | null = null;

export function configureApiClient(baseURL: string) {
  httpClient = new ApiClient(baseURL);
}

export function getApiClient(): ApiClient {
  if (!httpClient) {
    throw new Error(
      "API client not configured. Call configureApiClient() during app startup.",
    );
  }

  return httpClient;
}
