export async function api(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(result.message ?? 'The API is unavailable. Check that npm run api is running.'), { status: response.status })
  return result
}
