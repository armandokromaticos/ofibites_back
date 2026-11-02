/**
 * Diagnostica y reactiva el acceso de un usuario por correo, en la BD y en Supabase Auth.
 *
 * Sin `--aplicar` solo muestra el estado (no escribe nada). Con `--aplicar`:
 *   - `User.isActive = true` (login: "Tu cuenta está desactivada").
 *   - En Supabase Auth: correo confirmado ("Tu cuenta aún no está activada") y sin bloqueo (ban).
 *   - Si hay `NUEVA_PASSWORD`, fija esa contraseña.
 *   - Con `--membresias`, además reactiva sus membresías en empresas activas (login de CLIENT:
 *     "Aún no tienes acceso a una empresa"). Las empresas desactivadas no se tocan.
 *
 * Lee `.env` si existe. Para aplicar exige ACTIVAR_CONFIRM igual al host de DATABASE_URL:
 *
 *   yarn usuario:activar admin@ofibites.com
 *   ACTIVAR_CONFIRM=<host> yarn usuario:activar admin@ofibites.com --aplicar
 *   ACTIVAR_CONFIRM=<host> yarn usuario:activar admin@ofibites.com --aplicar --membresias
 *   ACTIVAR_CONFIRM=<host> NUEVA_PASSWORD='...' yarn usuario:activar admin@ofibites.com --aplicar
 */
import { PrismaClient } from "@prisma/client";
import {
  createClient,
  SupabaseClient,
  User as AuthUser,
} from "@supabase/supabase-js";

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno.
}

const prisma = new PrismaClient();

async function buscarEnAuth(
  supabase: SupabaseClient,
  authId: string | null,
  email: string,
): Promise<AuthUser | null> {
  if (authId) {
    const { data, error } = await supabase.auth.admin.getUserById(authId);
    if (error && error.status !== 404) throw error;
    if (data?.user) return data.user;
  }
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const encontrado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (encontrado) return encontrado;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const email = args
    .find((a) => !a.startsWith("--"))
    ?.trim()
    .toLowerCase();
  const aplicar = args.includes("--aplicar");
  const membresias = args.includes("--membresias");
  if (!email)
    throw new Error(
      "Uso: yarn usuario:activar <email> [--aplicar] [--membresias]",
    );

  const host = new URL(process.env.DATABASE_URL ?? "").host;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`BD: ${host} · Supabase: ${new URL(url).host}\n`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { memberships: { include: { company: true } } },
  });
  const authUser = await buscarEnAuth(supabase, user?.authId ?? null, email);

  if (!user) console.log(`BD: no hay User con ${email}.`);
  else {
    console.log(
      `BD: User ${user.id} · rol ${user.role} · isActive=${user.isActive} · authId=${user.authId ?? "—"}`,
    );
    for (const m of user.memberships)
      console.log(
        `    empresa "${m.company.legalName}" (activa=${m.company.isActive}) · ${m.role} · membresía activa=${m.isActive}`,
      );
  }

  const baneado =
    authUser?.banned_until && new Date(authUser.banned_until) > new Date();
  if (!authUser) console.log(`Auth: no hay usuario con ${email}.`);
  else
    console.log(
      `Auth: ${authUser.id} · confirmado=${Boolean(authUser.email_confirmed_at)} · bloqueado=${baneado ? authUser.banned_until : "no"}`,
    );
  if (user?.authId && authUser && user.authId !== authUser.id)
    console.log(
      `  ⚠ El authId de la BD (${user.authId}) no coincide con el de Auth (${authUser.id}).`,
    );

  if (!aplicar) {
    console.log(
      "\nSolo diagnóstico. Para aplicar: añade --aplicar y ACTIVAR_CONFIRM=" +
        host,
    );
    return;
  }
  if (process.env.ACTIVAR_CONFIRM !== host)
    throw new Error(
      `Abortado: exige confirmar la base de datos. Ejecuta con ACTIVAR_CONFIRM=${host}`,
    );
  if (!user || !authUser)
    throw new Error(
      "Abortado: el usuario tiene que existir en la BD y en Auth.",
    );

  const password = process.env.NUEVA_PASSWORD;
  const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
    email_confirm: true,
    ban_duration: "none",
    ...(password ? { password } : {}),
  });
  if (error) throw error;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: true,
      ...(user.authId ? {} : { authId: authUser.id }),
      ...(password ? { passwordChangedAt: new Date() } : {}),
    },
  });

  let reactivadas = 0;
  if (membresias) {
    const { count } = await prisma.companyMember.updateMany({
      where: { userId: user.id, isActive: false, company: { isActive: true } },
      data: { isActive: true },
    });
    reactivadas = count;
  }

  console.log(
    `\nListo: ${email} activo${password ? " y con contraseña nueva" : ""}` +
      (membresias ? ` · membresías reactivadas: ${reactivadas}` : "") +
      ".",
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
