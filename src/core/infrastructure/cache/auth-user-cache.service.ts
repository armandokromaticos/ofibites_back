import { Injectable } from "@nestjs/common";
import { Role } from "../../domain/enums/role.enum";
import type { CompanyMemberEntity } from "../../domain/entities/company-member.entity";

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
 *
 * También guarda la membresía activa por `userId:companyId` para
 * `CompanyRoleGuard` y `PlatformOrCompanyRoleGuard`. La invalidan
 * `CompanyMemberRepository` (create/update/delete) y los borrados en cascada
 * (`UserRepository.delete`, `CompanyRepository.delete`).
 */
@Injectable()
export class AuthUserCacheService {
  private readonly entradas = new Map<
    string,
    { valor: UsuarioCacheado; expiraEn: number }
  >();

  private readonly membresias = new Map<
    string,
    { valor: CompanyMemberEntity; expiraEn: number }
  >();
  /** Sube en cada invalidación: una carga que empezó antes no se guarda. */
  private generacionMembresias = 0;

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

  async obtenerMembresia(
    userId: string,
    companyId: string,
    cargar: () => Promise<CompanyMemberEntity | null>,
  ): Promise<CompanyMemberEntity | null> {
    const clave = `${userId}:${companyId}`;
    const entrada = this.membresias.get(clave);
    if (entrada && entrada.expiraEn > Date.now()) {
      this.membresias.delete(clave);
      this.membresias.set(clave, entrada);
      return entrada.valor;
    }
    this.membresias.delete(clave);

    const generacion = this.generacionMembresias;
    const membresia = await cargar();
    // Sin negativos: una invitación aceptada o un alta se ven al momento.
    if (!membresia || generacion !== this.generacionMembresias) {
      return membresia;
    }
    this.membresias.set(clave, {
      valor: membresia,
      expiraEn: Date.now() + TTL_MS,
    });
    if (this.membresias.size > MAX_ENTRADAS) {
      const masAntigua = this.membresias.keys().next();
      if (!masAntigua.done) {
        this.membresias.delete(masAntigua.value);
      }
    }
    return membresia;
  }

  invalidarMembresia(userId: string, companyId: string): void {
    this.generacionMembresias++;
    this.membresias.delete(`${userId}:${companyId}`);
  }

  /** Para escrituras que no saben qué membresías tocan (cascadas, en lote). */
  invalidarMembresias(): void {
    this.generacionMembresias++;
    this.membresias.clear();
  }
}
