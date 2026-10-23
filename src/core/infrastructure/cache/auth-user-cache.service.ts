import { Injectable } from "@nestjs/common";
import { Role } from "../../domain/enums/role.enum";

/** Lo único que los guards de rol leen del usuario. */
export interface UsuarioCacheado {
  id: string;
  role: Role;
  isActive: boolean;
}

const TTL_MS = 30 * 1000;
const MAX_ENTRADAS = 1000;

/**
 * Caché en memoria (LRU con TTL) del usuario por `authId` para los guards de
 * rol: evita un viaje a la BD por request. `UserRepository` invalida la
 * entrada al actualizar o borrar un usuario; el TTL cubre lo demás.
 */
@Injectable()
export class AuthUserCacheService {
  private readonly entradas = new Map<
    string,
    { valor: UsuarioCacheado; expiraEn: number }
  >();

  async obtener(
    authId: string,
    cargar: () => Promise<UsuarioCacheado | null>,
  ): Promise<UsuarioCacheado | null> {
    const entrada = this.entradas.get(authId);
    if (entrada && entrada.expiraEn > Date.now()) {
      // Reinsertar la mueve al final: el Map queda ordenado por uso (LRU).
      this.entradas.delete(authId);
      this.entradas.set(authId, entrada);
      return entrada.valor;
    }
    this.entradas.delete(authId);

    const usuario = await cargar();
    // No se cachean los "no encontrado": el usuario puede crearse enseguida.
    if (!usuario) {
      return null;
    }
    const valor = {
      id: usuario.id,
      role: usuario.role,
      isActive: usuario.isActive,
    };
    this.entradas.set(authId, { valor, expiraEn: Date.now() + TTL_MS });
    if (this.entradas.size > MAX_ENTRADAS) {
      const masAntigua = this.entradas.keys().next();
      if (!masAntigua.done) {
        this.entradas.delete(masAntigua.value);
      }
    }
    return valor;
  }

  /** `authId` puede ser null en usuarios sin cuenta de Supabase. */
  invalidar(authId: string | null): void {
    if (authId) {
      this.entradas.delete(authId);
    }
  }
}
