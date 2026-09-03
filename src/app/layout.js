import "./globals.css";

export const metadata = {
  title: "崇德志工社",
  description: "崇德志工社官方網站",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
