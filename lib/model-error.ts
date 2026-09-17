/** Turn an /api/edit-image failure into a sentence a host can act on. */
export async function friendlyModelError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.error === "string" && !data.error.startsWith("{")) return data.error
  } catch {
    /* non-JSON body */
  }
  if (response.status === 401) return "Your session expired. Sign in again and retry."
  if (response.status === 429) return "This model is busy right now. Try again in a minute."
  if (response.status === 504) return "This model took too long. Try again."
  return "This model couldn't finish. The other variations aren't affected."
}
