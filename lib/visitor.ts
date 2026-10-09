// Who's using PlateWise, roughly, for the admin page. The city comes from Vercel's own lookup of
// the internet connection; the internet address itself is never saved. The device number is a
// random one the app makes up, so a family can be counted once without knowing who they are.
export type Origin = { country?: string; region?: string; city?: string };

function header(request: Request, name: string) {
  const value = request.headers.get(name);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

export function requestOrigin(request: Request): Origin | undefined {
  const origin = {
    country: header(request, "x-vercel-ip-country"),
    region: header(request, "x-vercel-ip-country-region"),
    city: header(request, "x-vercel-ip-city"),
  };
  return origin.country || origin.city ? origin : undefined;
}

export const DEVICE_HEADER = "x-platewise-device";

export function requestDeviceId(request: Request): string | undefined {
  const id = request.headers.get(DEVICE_HEADER);
  return id && /^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : undefined;
}
