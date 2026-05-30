'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Pencil,
  Trash2,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTablePagination } from '@/components/data-table-pagination'
import { apiFetch } from '@/lib/api'

interface Post {
  id: number
  title: string
  slug: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  author: { email: string }
  createdAt: string
}

/** 상태 배지 variant 맵 — 명세 §7.5 참조 */
const STATUS_VARIANT = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

const STATUS_LABEL = {
  DRAFT: '임시저장',
  PUBLISHED: '발행됨',
  ARCHIVED: '보관됨',
}

type SortColumn = 'title' | 'status' | 'createdAt'
type SortDir = 'asc' | 'desc' | null

/** 정렬 토글 순환: null → asc → desc → null (명세 §8.5) */
function nextSortDir(cur: SortDir): SortDir {
  return cur === null ? 'asc' : cur === 'asc' ? 'desc' : null
}

/**
 * 포스트 목록 페이지 (`/posts`)
 * 명세 §7.4 DataTable — 정렬 토글 + 페이지네이션 + 상태 필터 + 검색
 */
export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: 'createdAt',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchPosts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Post[]>('/posts')
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '포스트를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await apiFetch(`/posts/${deleteId}`, { method: 'DELETE' })
      setPosts((prev) => prev.filter((p) => p.id !== deleteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeleteId(null)
    }
  }

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: nextSortDir(prev.dir) }
        : { column, dir: 'asc' },
    )
    setPage(1)
  }

  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
        const matchSearch =
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.slug.toLowerCase().includes(searchQuery.toLowerCase())
        return matchStatus && matchSearch
      }),
    [posts, statusFilter, searchQuery],
  )

  const sorted = useMemo(() => {
    if (!sort.dir) return filtered
    const m = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const diff =
        sort.column === 'createdAt'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : String(a[sort.column]).localeCompare(String(b[sort.column]), 'ko')
      return diff * m
    })
  }, [filtered, sort])

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const sortIcon = (column: SortColumn) => {
    if (sort.column !== column || sort.dir === null)
      return <ArrowUpDown className="h-3.5 w-3.5" />
    return sort.dir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">포스트</h1>
        <Button asChild>
          <Link href="/posts/new">
            <Plus className="h-4 w-4 mr-1" />
            새 포스트
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 필터 */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체</SelectItem>
            <SelectItem value="DRAFT">임시저장</SelectItem>
            <SelectItem value="PUBLISHED">발행됨</SelectItem>
            <SelectItem value="ARCHIVED">보관됨</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="제목 또는 슬러그 검색..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
      </div>

      {/* DataTable */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('title')}
                >
                  제목 {sortIcon('title')}
                </button>
              </TableHead>
              <TableHead className="w-[160px]">슬러그</TableHead>
              <TableHead className="w-[120px] text-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('status')}
                >
                  상태 {sortIcon('status')}
                </button>
              </TableHead>
              <TableHead className="w-[180px]">작성자</TableHead>
              <TableHead className="w-[140px]">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort('createdAt')}
                >
                  작성일 {sortIcon('createdAt')}
                </button>
              </TableHead>
              <TableHead className="w-[100px] text-center">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  포스트가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{post.slug}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={STATUS_VARIANT[post.status]}>
                      {STATUS_LABEL[post.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{post.author?.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/posts/${post.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && (
          <DataTablePagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </div>

      {/* 삭제 확인 다이얼로그 — 명세 §7.8 참조 */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              포스트 &apos;{posts.find((p) => p.id === deleteId)?.title}&apos;을 삭제합니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
