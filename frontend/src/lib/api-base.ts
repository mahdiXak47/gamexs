const LOCAL_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://api.gamexs.ir";

export function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "gamexs.ir" || hostname === "www.gamexs.ir") {
      const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!configuredUrl || configuredUrl.startsWith("http://localhost:")) {
        return PRODUCTION_API_URL;
      }
    }
  }

  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "gamexs.ir" || hostname === "www.gamexs.ir") {
      return PRODUCTION_API_URL;
    }
  }

  return LOCAL_API_URL;
}
