import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  return (
    <div className="card">
      <h1>Registro de Naves — AMP</h1>
      <p>Portal de abanderamiento en línea para navieras y armadores.</p>

      {user ? (
        <p>
          Sesión iniciada como {user.email}. <Link href="/solicitudes/nueva">Iniciar una nueva solicitud →</Link>
        </p>
      ) : (
        <p>
          <Link href="/registro">Crear cuenta</Link> o <Link href="/login">iniciar sesión</Link> para
          solicitar el registro de una nave.
        </p>
      )}
    </div>
  );
}
