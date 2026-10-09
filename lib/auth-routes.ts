import { emailIsSetUp } from "./email";
import { sessionSecret } from "./session";

// Login is switched on once the app can send emails and sign who's logged in.
export async function loginIsSetUp() {
  return Boolean(sessionSecret()) && (await emailIsSetUp());
}

export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
