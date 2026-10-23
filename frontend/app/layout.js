import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Yaqin · Tanishuv va uchrashuvlar',
  description: '18+ uchun tanishuv: profillar, match, chat va xavfsiz uchrashuvlar.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c0910' };

export default function RootLayout({ children }) {
  return (
    <html lang="uz">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
