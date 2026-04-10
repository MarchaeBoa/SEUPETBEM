import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Middleware que refresca a sessão do Supabase em toda requisição
 * e protege as rotas do grupo (dashboard). Usuário não logado que
 * tentar acessar uma rota protegida é redirecionado para /login.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Rotas protegidas do dashboard
  const protectedPaths = [
    "/dashboard",
    "/clientes",
    "/pets",
    "/agendamentos",
    "/configuracoes",
  ];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Sem as credenciais do Supabase configuradas, `createMiddlewareClient`
  // lança e derruba todas as requisições com 500 — inclusive a home pública.
  // Nesse caso tratamos como "sem sessão": páginas públicas renderizam
  // normalmente e rotas protegidas são redirecionadas para o login.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
    return res;
  }

  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (isProtected && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas, exceto:
     * - _next/static (assets)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos em /public
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
