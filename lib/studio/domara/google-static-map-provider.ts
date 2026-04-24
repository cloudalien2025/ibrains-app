export type GoogleStaticMapRequest = {
  latitude: number;
  longitude: number;
  locationLabel: string;
};

export function buildGoogleStaticMapUrl(request: GoogleStaticMapRequest, env: NodeJS.ProcessEnv): string | null {
  const key = ((env.GOOGLE_STATIC_MAPS_API_KEY || "").trim() || (env.GOOGLE_MAPS_API_KEY || "").trim()) as string;
  if (!key) return null;

  const lat = request.latitude.toFixed(5);
  const lon = request.longitude.toFixed(5);
  const marker = encodeURIComponent(`color:0x2563EB|label:P|${lat},${lon}`);
  const center = `${lat},${lon}`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=1280x720&scale=2&maptype=roadmap&center=${center}&zoom=11&markers=${marker}&key=${encodeURIComponent(key)}`;
}
