'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, FileText, File, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { clearToken } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/posts', label: '포스트', icon: FileText },
  { href: '/pages', label: '페이지', icon: File },
]

/**
 * Admin Shell — 사이드바(240px) + 메인 콘텐츠 레이아웃
 * 명세 §4 관리자 셸 레이아웃 참조
 * 로그아웃: AlertDialog 확인 후 JWT 클리어 → /login (명세 §6.3)
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleLogout = () => {
    clearToken()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — 240px fixed */}
      <aside className="w-[240px] flex-shrink-0 border-r bg-card flex flex-col">
        {/* 로고 */}
        <div className="h-14 flex items-center px-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">B</span>
            </div>
            <span className="font-semibold text-sm">brix-CMS</span>
          </div>
        </div>

        {/* 내비게이션 */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-accent font-medium border-l-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <Separator />

        {/* 로그아웃 */}
        <div className="p-3">
          <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2.5 text-muted-foreground">
                <LogOut className="h-4 w-4" />
                로그아웃
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>로그아웃</AlertDialogTitle>
                <AlertDialogDescription>
                  로그아웃하시겠습니까? 로그인 페이지로 이동합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>로그아웃</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 space-y-6">{children}</main>
      </div>
    </div>
  )
}
