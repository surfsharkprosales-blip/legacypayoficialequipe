import { handleAuth } from '@/lib/middleware-auth'
import { type NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'

// Cache de IPs bloqueados (atualiza a cada 60 segundos)
let blockedIpsCache: Set<string> = new Set()
let lastCacheUpdate = 0
const CACHE_TTL = 60000 // 60 segundos

async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  
  // Verifica se banco de dados está configurado
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!dbUrl) {
    // Sem banco configurado, permite acesso
    return false
  }
  
  // Verifica cache primeiro
  const now = Date.now()
  if (now - lastCacheUpdate < CACHE_TTL && blockedIpsCache.size > 0) {
    return blockedIpsCache.has(ip)
  }
  
  // Atualiza cache
  try {
    const sql = postgres(dbUrl, { ssl: 'require' })
    const blockedIps = await sql`SELECT ip_address FROM blocked_ips`
    await sql.end()
    blockedIpsCache = new Set(blockedIps.map((row: { ip_address: string }) => row.ip_address))
    lastCacheUpdate = now
    return blockedIpsCache.has(ip)
  } catch (error) {
    // Em caso de erro, apenas ignora a verificação de bloqueio
    return false
  }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') ||
         'unknown'
}

// Lista de dominios principais do sistema (nao sao checkouts)
const MAIN_DOMAINS = [
  'localhost',
  'legacypay.site',
  'legacypay.com.br',
  'vercel.app',
]

// Dominio dedicado para todos os checkouts
const CHECKOUT_DOMAIN = 'pay-checkout-pagamentoseguros.online'

function isMainDomain(hostname: string): boolean {
  return MAIN_DOMAINS.some(domain => 
    hostname === domain || 
    hostname.endsWith(`.${domain}`) ||
    hostname.includes('localhost')
  )
}

function isCheckoutDomain(hostname: string): boolean {
  const cleanHostname = hostname.replace(/^www\./, '').split(':')[0]
  return cleanHostname === CHECKOUT_DOMAIN || cleanHostname === `www.${CHECKOUT_DOMAIN}`
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Ignorar a pagina de bloqueado para evitar loop
  if (pathname === '/blocked') {
    const response = NextResponse.next()
    // Adicionar headers de seguranca
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    return response
  }
  
  // Ignorar webhooks do Telegram e PIX do bot (nao precisa de auth)
  if (pathname.startsWith('/api/telegram') || pathname.startsWith('/api/webhooks/telegram-pix')) {
    return NextResponse.next()
  }
  
  // Verificar se IP esta bloqueado
  const clientIp = getClientIp(request)
  const blocked = await isIpBlocked(clientIp)
  
  if (blocked) {
    const url = request.nextUrl.clone()
    url.pathname = '/blocked'
    return NextResponse.rewrite(url)
  }
  
  // Se for dominio principal, segue fluxo normal de auth
  if (isMainDomain(hostname)) {
    return await handleAuth(request)
  }
  
  // Se for dominio de checkout (pay-checkout-pagamentoseguros.online)
  if (isCheckoutDomain(hostname)) {
    // Ignora arquivos estaticos e API
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.includes('.') // arquivos com extensao
    ) {
      return NextResponse.next()
    }
    
    // Se acessar a raiz, mostra pagina inicial do checkout
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone()
      url.pathname = '/checkout-home'
      return NextResponse.rewrite(url)
    }
    
    // Pega o slug do path (ex: /meu-produto -> meu-produto)
    const slug = pathname.replace(/^\//, '').split('/')[0]
    
    if (slug) {
      // Reescreve para /pay/[slug]
      const url = request.nextUrl.clone()
      url.pathname = `/pay/${slug}`
      return NextResponse.rewrite(url)
    }
    
    return NextResponse.next()
  }
  
  // Outro dominio desconhecido - segue fluxo normal
  return await handleAuth(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
