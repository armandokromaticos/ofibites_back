import { Role } from "../../domain/enums/role.enum";
import { AuthUserCacheService } from "./auth-user-cache.service";

describe("AuthUserCacheService", () => {
  const usuario = { id: "user-1", role: Role.CLIENT, isActive: true };
  let cache: AuthUserCacheService;
  let cargar: jest.Mock;
  let ahora: number;

  beforeEach(() => {
    cache = new AuthUserCacheService();
    cargar = jest.fn().mockResolvedValue(usuario);
    ahora = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => ahora);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("en un acierto no vuelve a cargar de la BD", async () => {
    await cache.obtener("auth-1", cargar);
    const segundo = await cache.obtener("auth-1", cargar);

    expect(segundo).toEqual(usuario);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("recarga cuando la entrada caduca", async () => {
    await cache.obtener("auth-1", cargar);
    ahora += 31 * 1000;
    await cache.obtener("auth-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("recarga tras invalidar la entrada", async () => {
    await cache.obtener("auth-1", cargar);
    cache.invalidar("auth-1");
    cargar.mockResolvedValue({ ...usuario, isActive: false });

    const usuarioRecargado = await cache.obtener("auth-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
    expect(usuarioRecargado?.isActive).toBe(false);
  });

  it("no cachea el usuario no encontrado", async () => {
    cargar.mockResolvedValue(null);
    await cache.obtener("auth-1", cargar);
    await cache.obtener("auth-1", cargar);

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("descarta la entrada menos usada al superar el tamaño máximo", async () => {
    for (let i = 0; i <= 1000; i++) {
      await cache.obtener(`auth-${i}`, cargar);
    }
    cargar.mockClear();

    await cache.obtener("auth-1000", cargar);
    await cache.obtener("auth-0", cargar);

    expect(cargar).toHaveBeenCalledTimes(1);
  });
});
