'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { ContentForm, type ContentFormValues } from '@/components/content-form'
import { apiFetch } from '@/lib/api'

interface PostDetail {
  id: number
  title: string
  slug: string
  content?: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

/**
 * 포스트 편집 페이지 (`/posts/[id]/edit`)
 * 명세 §6.5 참조 — API: GET /posts/:id, PATCH /posts/:id
 */
export default function EditPostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    apiFetch<PostDetail>(`/posts/${id}`)
      .then(setPost)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '포스트를 불러오지 못했습니다.')
      })
      .finally(() => setIsFetching(false))
  }, [id])

  const handleSubmit = async (data: ContentFormValues) => {
    setError(null)
    setIsLoading(true)
    try {
      await apiFetch(`/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      router.push('/posts')
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
      type="post"
      defaultValues={post ?? undefined}
      onSubmit={handleSubmit}
      backHref="/posts"
      pageTitle="포스트 편집"
      error={error}
      isLoading={isLoading}
    />
  )
}
