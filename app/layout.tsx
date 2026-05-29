import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quotex Signals',
  description: 'Sala de sinais autônoma — análise técnica + Quotex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
