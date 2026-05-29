import Link from 'next/link'
import { FileText, File } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 대시보드 페이지 (`/dashboard`)
 * 포스트/페이지 관리로 빠르게 이동하는 진입점
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">brix-CMS 콘텐츠 관리 시스템에 오신 걸 환영합니다.</p>
      </div>

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
