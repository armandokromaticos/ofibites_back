import {
  CATALOG_CACHE_TTL_MS,
  CatalogCacheService,
} from "./catalog-cache.service";

describe("CatalogCacheService", () => {
  let cache: CatalogCacheService;
  let cargar: jest.Mock;
  let ahora: number;

  beforeEach(() => {
    cache = new CatalogCacheService();
    cargar = jest.fn().mockResolvedValue(["catalogo"]);
    ahora = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => ahora);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("en un acierto no vuelve a cargar de la BD", async () => {
    await cache.obtener("catalogo:activo", cargar);
    const segundo = await cache.obtener("catalogo:activo", cargar);

    expect(segundo).toEqual(["catalogo"]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("claves distintas no comparten entrada", async () => {
    await cache.obtener("banners:activos:home", cargar);
    await cache.obtener("banners:activos:", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("recarga cuando la entrada caduca", async () => {
    await cache.obtener("catalogo:activo", cargar);
    ahora += CATALOG_CACHE_TTL_MS - 1;
    await cache.obtener("catalogo:activo", cargar);
    expect(cargar).toHaveBeenCalledTimes(1);

    ahora += 1;
    await cache.obtener("catalogo:activo", cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("recarga tras invalidar (escritura en el catálogo)", async () => {
    await cache.obtener("catalogo:activo", cargar);
    await cache.obtener("secciones:activas", cargar);
    cache.invalidar();
    cargar.mockResolvedValue(["catalogo nuevo"]);

    const catalogo = await cache.obtener("catalogo:activo", cargar);
    await cache.obtener("secciones:activas", cargar);

    expect(catalogo).toEqual(["catalogo nuevo"]);
    expect(cargar).toHaveBeenCalledTimes(4);
  });

  it("una carga en curso al invalidar no queda guardada", async () => {
    let terminar: (valor: string[]) => void = () => undefined;
    const lenta = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          terminar = resolve;
        }),
    );

    const enCurso = cache.obtener("catalogo:activo", lenta);
    cache.invalidar();
    terminar(["viejo"]);
    await enCurso;

    await expect(cache.obtener("catalogo:activo", cargar)).resolves.toEqual([
      "catalogo",
    ]);
  });

  it("las peticiones simultáneas comparten una sola carga", async () => {
    await Promise.all([
      cache.obtener("catalogo:activo", cargar),
      cache.obtener("catalogo:activo", cargar),
    ]);

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("no cachea los errores (p. ej. un 404)", async () => {
    cargar.mockRejectedValueOnce(new Error("no existe"));

    await expect(cache.obtener("ficha:x", cargar)).rejects.toThrow("no existe");
    await expect(cache.obtener("ficha:x", cargar)).resolves.toEqual([
      "catalogo",
    ]);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("descarta la entrada más antigua al superar el tamaño máximo", async () => {
    for (let i = 0; i <= 500; i++) {
      await cache.obtener(`banners:activos:${i}`, cargar);
    }
    cargar.mockClear();

    await cache.obtener("banners:activos:500", cargar);
    await cache.obtener("banners:activos:0", cargar);

    expect(cargar).toHaveBeenCalledTimes(1);
  });
});
