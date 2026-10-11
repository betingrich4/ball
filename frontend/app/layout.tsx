import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Pitch — Live Football",
  description: "Premium live football scores, standings and stats.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0a0e1a] text-slate-100 font-[Inter] antialiased">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">{children}</main>
        <footer className="border-t border-white/5 mt-16 py-8 text-center text-xs text-slate-500">
          Data provided by Free Football Live Scores API. Snapshots may be delayed.
        </footer>
      </body>
    </html>
  );
}
