import { PrismaService } from "../database/prisma/prisma.service";
import { BannerRepository } from "../repositories/banner.repository";
import { ComboRepository } from "../repositories/combo.repository";
import { ProductRepository } from "../repositories/product.repository";
import { ProductModifierRepository } from "../repositories/product-modifier.repository";
import { ProductModifierGroupRepository } from "../repositories/product-modifier-group.repository";
import { ProductSizeRepository } from "../repositories/product-size.repository";
import { SectionRepository } from "../repositories/section.repository";
import { TagRepository } from "../repositories/tag.repository";
import { CatalogCacheService } from "./catalog-cache.service";

/** Prisma falso: cualquier `prisma.<modelo>.<op>()` resuelve `{ count: 1 }`. */
function fakePrisma(): PrismaService {
  const model = new Proxy(
    {},
    { get: () => jest.fn().mockResolvedValue({ count: 1 }) },
  );
  return new Proxy(
    { $transaction: jest.fn().mockResolvedValue([]) },
    {
      get: (target, prop) =>
        prop === "$transaction" ? target.$transaction : model,
    },
  ) as unknown as PrismaService;
}

type Repo = {
  delete(id: string): Promise<void>;
  exists(args: object): Promise<boolean>;
};

const REPOSITORIES: [
  string,
  new (prisma: PrismaService, cache: CatalogCacheService) => Repo,
][] = [
  ["BannerRepository", BannerRepository],
  ["ComboRepository", ComboRepository],
  ["ProductRepository", ProductRepository],
  ["ProductModifierRepository", ProductModifierRepository],
  ["ProductModifierGroupRepository", ProductModifierGroupRepository],
  ["ProductSizeRepository", ProductSizeRepository],
  ["SectionRepository", SectionRepository],
  ["TagRepository", TagRepository],
];

describe("invalidación de la caché del catálogo en los repositorios", () => {
  let cache: CatalogCacheService;
  let invalidar: jest.SpyInstance;

  beforeEach(() => {
    cache = new CatalogCacheService();
    invalidar = jest.spyOn(cache, "invalidar");
  });

  it.each(REPOSITORIES)(
    "%s invalida al borrar y no al leer",
    async (_, Repository) => {
      const repository = new Repository(fakePrisma(), cache);

      await repository.exists({});
      expect(invalidar).not.toHaveBeenCalled();

      await repository.delete("id-1");
      expect(invalidar).toHaveBeenCalledTimes(1);
    },
  );

  it("ProductModifierRepository invalida al cambiar precios por tamaño y tags", async () => {
    const repository = new ProductModifierRepository(fakePrisma(), cache);

    await repository.setSizePrices("m-1", []);
    await repository.assignTags("m-1", ["t-1"]);
    await repository.removeTag("m-1", "t-1");

    expect(invalidar).toHaveBeenCalledTimes(3);
  });

  it("ProductRepository invalida al quitar un tag", async () => {
    await new ProductRepository(fakePrisma(), cache).removeTag("p-1", "t-1");

    expect(invalidar).toHaveBeenCalledTimes(1);
  });

  it("SectionRepository invalida al quitar un ítem", async () => {
    await new SectionRepository(fakePrisma(), cache).removeItem("s-1", "i-1");

    expect(invalidar).toHaveBeenCalledTimes(1);
  });
});
