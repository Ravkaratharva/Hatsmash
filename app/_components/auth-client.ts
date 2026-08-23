"use client";

type ApiError = { error?: { code?: string; message?: string } };

export async function readAuthJson<T>(response: Response): Promise<T & ApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: { code: "AUTH_UNAVAILABLE", message: "Secure sign-in is temporarily unavailable." } } as T & ApiError;
  }
  return response.json() as Promise<T & ApiError>;
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const data = await readAuthJson<{ token?: string }>(response);
  if (!response.ok || !data.token) throw new Error(data.error?.message ?? "That request could not be verified.");
  return data.token;
}

export async function signOut(returnTo = "/"): Promise<string> {
  const csrf = await getCsrfToken();
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-hatsmash-csrf": csrf,
    },
    body: JSON.stringify({ returnTo }),
  });
  const data = await readAuthJson<{ returnTo?: string }>(response);
  if (!response.ok || !data.returnTo) throw new Error(data.error?.message ?? "We could not sign you out.");
  return data.returnTo;
}
