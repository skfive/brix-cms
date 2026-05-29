'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiFetch, setToken } from '@/lib/api'

/** 명세 §7 zod 스키마 — 로그인 */
const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginResponse {
  access_token: string
}

/**
 * 로그인 페이지 (`/login`)
 * 명세 §6.1 로그인 — Auth 카드 중앙 배치
 * API: POST /auth/login → JWT 저장 → /dashboard
 */
export default function LoginPage() {
  const router = useRouter()
  const [apiError, setApiError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setApiError(null)
    setIsLoading(true)
    try {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
        auth: false,
      })
      setToken(res.access_token)
      router.push('/dashboard')
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : '이메일 또는 비밀번호가 올바르지 않습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-[400px]">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">B</span>
          </div>
          <span className="text-lg font-bold">brix-CMS</span>
        </div>
        <CardTitle className="text-xl">계정에 로그인하세요</CardTitle>
        <CardDescription>이메일과 비밀번호를 입력하세요</CardDescription>
      </CardHeader>
      <CardContent>
        {apiError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>이메일 또는 비밀번호가 올바르지 않습니다.</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              가입하기
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
