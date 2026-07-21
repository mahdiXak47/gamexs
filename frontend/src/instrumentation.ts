export async function register() {
  // Node.js native fetch (undici) does not respect HTTPS_PROXY env vars.
  // Set a global ProxyAgent so all server-side fetch calls go through the proxy.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.HTTPS_PROXY) {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  }
}
