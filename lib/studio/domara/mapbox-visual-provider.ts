export type MapboxVisualRequest = {
  latitude: number;
  longitude: number;
  title: string;
  locationLabel: string;
};

function resolveStylePath(env: NodeJS.ProcessEnv): string {
  const styleId = (env.MAPBOX_STYLE_ID || "").trim();
  if (styleId) return styleId;

  const styleUrl = (env.MAPBOX_STYLE_URL || "").trim();
  if (styleUrl.startsWith("mapbox://styles/")) {
    return styleUrl.replace("mapbox://styles/", "");
  }
  return "mapbox/streets-v12";
}

export function buildMapboxStaticImageUrl(request: MapboxVisualRequest, env: NodeJS.ProcessEnv): string | null {
  const token = (env.MAPBOX_ACCESS_TOKEN || "").trim();
  if (!token) return null;

  const stylePath = resolveStylePath(env);
  const lon = request.longitude.toFixed(5);
  const lat = request.latitude.toFixed(5);
  const marker = `pin-s+2563EB(${lon},${lat})`;
  const center = `${lon},${lat},10`;
  const overlay = encodeURIComponent(marker);

  return `https://api.mapbox.com/styles/v1/${stylePath}/static/${overlay}/${center}/1280x720?access_token=${encodeURIComponent(token)}`;
}
