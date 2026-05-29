'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { ContentForm, type ContentFormValues } from '@/components/content-form'
import { apiFetch } from '@/lib/api'

interface PageDetail {
  id: number
  title: string
  slug: string
  content?: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

/**
 * 페이지 편집 (`/pages/[id]/edit`)
 * 명세 §6.6 — API: GET /pages/:id, PATCH /pages/:id
 */
export default function EditPagePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [page, setPage] = useState<PageDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    apiFetch<PageDetail>(`/pages/${id}`)
      .then(setPage)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '페이지를 불러오지 못했습니다.')
      })
      .finally(() => setIsFetching(false))
  }, [id])

  const handleSubmit = async (data: ContentFormValues) => {
    setError(null)
    setIsLoading(true)
    try {
      await apiFetch(`/pages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      router.push('/pages')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        불러오는 중...
      </div>
    )
  }

  return (
    <ContentForm
      type="page"
      defaultValues={page ?? undefined}
      onSubmit={handleSubmit}
      backHref="/pages"
      pageTitle="페이지 편집"
      error={error}
      isLoading={isLoading}
    />
  )
}
