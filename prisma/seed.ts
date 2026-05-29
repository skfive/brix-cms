/**
 * brix-CMS 데모 계정 시드 스크립트 (BF-711)
 *
 * 실행 방법:
 *   pnpm seed
 *   # 또는
 *   npx ts-node -r tsconfig-paths/register prisma/seed.ts
 *
 * 생성되는 데모 계정:
 *   Email:    demo@brix-cms.local
 *   Password: Demo1234!
 *   Role:     user
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'demo@brix-cms.local'
const DEMO_PASSWORD = 'Demo1234!'
const SALT_ROUNDS = 10

async function main() {
  console.log('🌱 시드 시작...')

  // 이미 존재하는 경우 upsert (중복 실행 안전)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS)

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      password_hash: passwordHash,
    },
    create: {
      email: DEMO_EMAIL,
      password_hash: passwordHash,
      role: 'user',
    },
  })

  console.log(`✅ 데모 계정 생성/갱신 완료`)
  console.log(`   Email:    ${user.email}`)
  console.log(`   Password: ${DEMO_PASSWORD}`)
  console.log(`   Role:     ${user.role}`)
  console.log(`   ID:       ${user.id}`)

  // 데모용 샘플 포스트 (없을 경우에만 생성)
  const existingPost = await prisma.post.findFirst({
    where: { authorId: user.id, slug: 'welcome-to-brix-cms' },
  })

  if (!existingPost) {
    const post = await prisma.post.create({
      data: {
        title: 'brix-CMS 에 오신 걸 환영합니다',
        slug: 'welcome-to-brix-cms',
        content:
          '이 포스트는 e2e/API 테스트용 데모 데이터입니다.\n\nbrix-CMS 는 NestJS + Prisma + shadcn/ui 기반 CMS 입니다.',
        status: 'PUBLISHED',
        authorId: user.id,
      },
    })
    console.log(`✅ 데모 포스트 생성: "${post.title}" (slug: ${post.slug})`)
  } else {
    console.log(`ℹ️  데모 포스트 이미 존재: "${existingPost.title}"`)
  }

  // 데모용 샘플 페이지
  const existingPage = await prisma.page.findFirst({
    where: { authorId: user.id, slug: 'about' },
  })

  if (!existingPage) {
    const page = await prisma.page.create({
      data: {
        title: 'About',
        slug: 'about',
        content: '이 페이지는 e2e/API 테스트용 데모 데이터입니다.',
        status: 'PUBLISHED',
        authorId: user.id,
      },
    })
    console.log(`✅ 데모 페이지 생성: "${page.title}" (slug: ${page.slug})`)
  } else {
    console.log(`ℹ️  데모 페이지 이미 존재: "${existingPage.title}"`)
  }

  console.log('🎉 시드 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 시드 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
