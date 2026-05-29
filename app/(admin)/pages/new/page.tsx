'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { ContentForm, type ContentFormValues } from '@/components/content-form'
import { apiFetch } from '@/lib/api'

/**
 * 페이지 작성 (`/pages/new`)
 * 명세 §6.6 — API: POST /pages
 */
export default function NewPagePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: ContentFormValues) => {
    setError(null)
    setIsLoading(true)
    try {
      await apiFetch('/pages', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      router.push('/pages')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ContentForm
      type="page"
      onSubmit={handleSubmit}
      backHref="/pages"
      pageTitle="새 페이지"
      error={error}
      isLoading={isLoading}
    />
  )
}
