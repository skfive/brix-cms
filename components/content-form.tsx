'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** 명세 §7 zod 스키마 — 포스트·페이지 공통 */
export const contentSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요').max(200, '200자 이하로 입력하세요'),
  slug: z.string().max(200, '200자 이하로 입력하세요').optional(),
  content: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})

export type ContentFormValues = z.infer<typeof contentSchema>

interface ContentFormProps {
  /** 'post' | 'page' */
  type: 'post' | 'page'
  /** 편집 시 초기 값 */
  defaultValues?: Partial<ContentFormValues>
  /** 저장 핸들러 */
  onSubmit: (data: ContentFormValues) => Promise<void>
  /** 목록 경로 */
  backHref: string
  /** 페이지 제목 */
  pageTitle: string
  /** 오류 메시지 */
  error?: string | null
  /** 로딩 상태 */
  isLoading?: boolean
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200)
}

/**
 * 포스트·페이지 공통 편집 폼
 * 명세 §6.5 참조 — 제목/슬러그/상태/내용 입력 + 슬러그 자동 생성
 */
export function ContentForm({
  type: _type,
  defaultValues,
  onSubmit,
  backHref,
  pageTitle,
  error,
  isLoading = false,
}: ContentFormProps) {
  const [autoSlug, setAutoSlug] = useState(!defaultValues?.slug)
  const [status, setStatus] = useState<ContentFormValues['status']>(
    defaultValues?.status ?? 'DRAFT',
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      slug: defaultValues?.slug ?? '',
      content: defaultValues?.content ?? '',
      status: defaultValues?.status ?? 'DRAFT',
    },
  })

  const titleValue = watch('title')

  // 슬러그 자동 생성 (title 변경 시)
  useEffect(() => {
    if (autoSlug) {
      setValue('slug', slugify(titleValue ?? ''))
    }
  }, [titleValue, autoSlug, setValue])

  const handleFormSubmit = (data: ContentFormValues) => {
    return onSubmit({ ...data, status })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* 제목 */}
            <div className="space-y-1.5">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                placeholder="제목을 입력하세요"
                {...register('title')}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* 슬러그 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="slug">슬러그</Label>
                {autoSlug && (
                  <Badge variant="secondary" className="text-xs">자동생성</Badge>
                )}
              </div>
              <Input
                id="slug"
                placeholder="url-slug"
                {...register('slug')}
                onFocus={() => setAutoSlug(false)}
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>

            {/* 상태 */}
            <div className="space-y-1.5">
              <Label>상태 *</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  const val = v as ContentFormValues['status']
                  setStatus(val)
                  setValue('status', val)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">임시저장 (DRAFT)</SelectItem>
                  <SelectItem value="PUBLISHED">발행 (PUBLISHED)</SelectItem>
                  <SelectItem value="ARCHIVED">보관 (ARCHIVED)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 내용 */}
            <div className="space-y-1.5">
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                placeholder="내용을 입력하세요..."
                className="min-h-[320px] resize-y"
                {...register('content')}
              />
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" asChild>
                <Link href={backHref}>취소</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => {
                  setValue('status', 'DRAFT')
                  setStatus('DRAFT')
                  handleSubmit(handleFormSubmit)()
                }}
              >
                임시저장
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
