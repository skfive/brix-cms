'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { ContentForm, type ContentFormValues } from '@/components/content-form'
import { apiFetch } from '@/lib/api'

/**
 * 포스트 작성 페이지 (`/posts/new`)
 * 명세 §6.5 참조 — API: POST /posts
 */
export default function NewPostPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: ContentFormValues) => {
    setError(null)
    setIsLoading(true)
    try {
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      router.push('/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ContentForm
      type="post"
      onSubmit={handleSubmit}
      backHref="/posts"
      pageTitle="새 포스트"
      error={error}
      isLoading={isLoading}
    />
  )
}
