import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Registro de Naves — AMP",
  description: "Sistema de Registro de Naves de la Autoridad Marítima de Panamá",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="app-header">
          <strong>AMP — Registro de Naves</strong>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
