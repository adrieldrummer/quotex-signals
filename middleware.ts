// Sem auth — single-tenant. Middleware vazio (poderia remover, deixei só pra estrutura).
import { NextResponse } from 'next/server';
export function middleware() { return NextResponse.next(); }
export const config = { matcher: [] };
