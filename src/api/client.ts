export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshTokenVal: string | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor(url: string) {
    this.baseURL = url;
    if (typeof localStorage !== "undefined") {
      this.token = localStorage.getItem("hosanna_access_token");
      this.refreshTokenVal = localStorage.getItem("hosanna_refresh_token");
    }
  }

  public setBaseURL(url: string) {
    // TODO: Add it to settings
    this.baseURL = url.endsWith("/") ? url.slice(0, -1) : url;
  }

  public getBaseURL(): string {
    return this.baseURL;
  }

  public setTokens(
    accessToken: string | null,
    refreshToken: string | null = null,
  ) {
    this.token = accessToken;
    if (accessToken) {
      localStorage.setItem("hosanna_access_token", accessToken);
    } else {
      localStorage.removeItem("hosanna_access_token");
    }

    if (refreshToken !== null) {
      this.refreshTokenVal = refreshToken;
      if (refreshToken) {
        localStorage.setItem("hosanna_refresh_token", refreshToken);
      } else {
        localStorage.removeItem("hosanna_refresh_token");
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getRefreshToken(): string | null {
    return this.refreshTokenVal;
  }

  public onUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const req = await this.request_raw(endpoint, options);

    if (req.status === 204) {
      return {} as T;
    }

    return req.json();
  }

  public async request_raw(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = endpoint.startsWith("/")
      ? `${this.baseURL}${endpoint}`
      : `${this.baseURL}/${endpoint}`;

    const requestHeaders: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => {
          requestHeaders[k] = v;
        });
      } else if (typeof options.headers === "object") {
        Object.entries(options.headers).forEach(([k, v]) => {
          if (v !== undefined) requestHeaders[k] = String(v);
        });
      }
    }
    if (this.token) {
      requestHeaders["Authorization"] = `Bearer ${this.token}`;
    }
    if (
      !requestHeaders["Content-Type"] &&
      !(options.body instanceof FormData)
    ) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const config: RequestInit = {
      credentials: "include",
      ...options,
      headers: requestHeaders,
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: any) {
      throw new ApiError(
        `Network Error: ${err.message || "Failed to connect to server"}`,
        0,
      );
    }

    // Handle 401 Unauthorized -> Attempt token refresh
    if (
      response.status === 401 &&
      this.refreshTokenVal &&
      !endpoint.includes("auth/login")
    ) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Retry original request with new token
        requestHeaders["Authorization"] = `Bearer ${this.token}`;
        response = await fetch(url, {
          ...options,
          credentials: "include",
          headers: requestHeaders,
        });
      } else {
        if (this.onUnauthorizedCallback) {
          this.onUnauthorizedCallback();
        }
        throw new ApiError(
          "Session expired. Please log in again.",
          401,
          "SESSION_EXPIRED",
        );
      }
    } else if (response.status === 401) {
      if (this.onUnauthorizedCallback && !endpoint.includes("auth/login")) {
        this.onUnauthorizedCallback();
      }
    }

    if (!response.ok) {
      let errorMessage = `Server error (${response.status})`;
      let errorCode: string | undefined;
      let errorDetails: any;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          if (typeof errorData.error === "object") {
            errorMessage = errorData.error.message || errorMessage;
            errorCode = errorData.error.code;
            errorDetails = errorData.error.details;
          } else {
            errorMessage = errorData.error;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Fallback to generic message
      }
      throw new ApiError(
        errorMessage,
        response.status,
        errorCode,
        errorDetails,
      );
    }

    return response;
  }

  private async tryRefreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshTokenVal }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          this.setTokens(
            data.accessToken,
            data.refreshToken || this.refreshTokenVal,
          );
          return true;
        }
      }
    } catch {
      // Refresh failed
    }
    this.setTokens(null, null);
    return false;
  }
}
