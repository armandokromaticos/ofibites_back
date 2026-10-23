import { Injectable } from "@nestjs/common";

export const CATALOG_CACHE_TTL_MS = 60 * 1000;
const MAX_ENTRADAS = 500;

/**
 * Caché en memoria (TTL corto) de las lecturas públicas del catálogo:
 * catálogo, ficha, secciones y banners activos. Los precios y la visibilidad
 * del catálogo no dependen de la empresa ni del usuario, así que la clave no
 * los incluye. Los repositorios del catálogo llaman a `invalidar()` en cada
 * escritura; el TTL cubre lo que cambie por fuera (SQL a mano, otra instancia).
 *
 * Nunca se usa para el carrito ni el checkout: ahí los precios se recalculan
 * siempre desde la BD.
 */
@Injectable()
export class CatalogCacheService {
  private readonly entradas = new Map<
    string,
    { valor: Promise<unknown>; expiraEn: number }
  >();

  /**
   * Devuelve el valor cacheado o lo carga. Guarda la promesa, no el valor:
   * las peticiones simultáneas comparten una sola carga. Los errores no se
   * cachean (p. ej. un 404).
   */
  obtener<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
    const entrada = this.entradas.get(clave);
    if (entrada && entrada.expiraEn > Date.now()) {
      return entrada.valor as Promise<T>;
    }
    this.entradas.delete(clave);

    const valor = cargar();
    this.entradas.set(clave, {
      valor,
      expiraEn: Date.now() + CATALOG_CACHE_TTL_MS,
    });
    valor.catch(() => {
      if (this.entradas.get(clave)?.valor === valor) {
        this.entradas.delete(clave);
      }
    });
    if (this.entradas.size > MAX_ENTRADAS) {
      const masAntigua = this.entradas.keys().next();
      if (!masAntigua.done) {
        this.entradas.delete(masAntigua.value);
      }
    }
    return valor;
  }

  /**
   * Vacía toda la caché. Una carga en curso ya no se guarda (su entrada se
   * borró), así que nadie que llegue después ve datos previos a la escritura.
   */
  invalidar(): void {
    this.entradas.clear();
  }
}
