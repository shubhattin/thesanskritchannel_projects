/** Browser PostHog options for exception capture and server-replay linking. */
export const posthogErrorTrackingConfig = () => {
  const hostname = globalThis.location?.hostname;
  if (hostname) {
    return { capture_exceptions: true, tracing_headers: [hostname] };
  }
  return { capture_exceptions: true };
};
