/**
 * brix-CMS API 클라이언트 유틸리티
 * - NestJS 백엔드 (기본 포트 3000) 와 통신
 * - JWT 토큰을 localStorage 에서 읽어 Authorization 헤더에 첨부
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

export function setToken(token: string): void {
  localStorage.setItem('access_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('access_token')
}

interface RequestOptions extends RequestInit {
  auth?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, headers: extraHeaders, ...rest } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  }

  if (auth) {
    const token = getToken()
    if (token) {
      ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { headers, ...rest })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { message?: string }).message ?? `HTTP ${res.status}`
    throw new Error(message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}
