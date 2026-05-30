'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, File, CheckCircle2, FileEdit } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatCard } from '@/components/stat-card'
import { apiFetch } from '@/lib/api'

interface Content {
  id: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

/**
 * 대시보드 페이지 (`/dashboard`)
 * 명세 §7.3 — 통계 카드 4종 + 콘텐츠 관리 빠른 진입점
 */
export default function DashboardPage() {
  const [posts, setPosts] = useState<Content[]>([])
  const [pages, setPages] = useState<Content[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [p, g] = await Promise.all([
          apiFetch<Content[]>('/posts'),
          apiFetch<Content[]>('/pages'),
        ])
        setPosts(p)
        setPages(g)
      } catch (err) {
        setError(err instanceof Error ? err.message : '통계를 불러오지 못했습니다.')
      }
    }
    load()
  }, [])

  const publishedPosts = posts.filter((p) => p.status === 'PUBLISHED').length
  const draftCount =
    posts.filter((p) => p.status === 'DRAFT').length +
    pages.filter((p) => p.status === 'DRAFT').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          brix-CMS 콘텐츠 관리 시스템에 오신 걸 환영합니다.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 통계 카드 그리드 — 명세 §7.3 (mobile 1열 / sm 2열 / lg 4열) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="전체 포스트" value={posts.length} icon={FileText} />
        <StatCard
          label="발행된 포스트"
          value={publishedPosts}
          trend="up"
          icon={CheckCircle2}
        />
        <StatCard label="전체 페이지" value={pages.length} icon={File} />
        <StatCard label="임시저장" value={draftCount} icon={FileEdit} />
      </div>

      {/* 빠른 작업 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">포스트</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">블로그 포스트를 작성하고 발행합니다.</CardDescription>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/posts/new">새 포스트</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/posts">목록 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">페이지</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">정적 페이지를 작성하고 관리합니다.</CardDescription>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/pages/new">새 페이지</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/pages">목록 보기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
