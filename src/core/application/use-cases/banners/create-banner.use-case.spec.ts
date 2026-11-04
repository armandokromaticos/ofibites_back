import { CreateBannerUseCase } from "./create-banner.use-case";
import { BannerEntity } from "../../../domain/entities/banner.entity";
import type { IBannerRepository } from "../../../domain/repositories/banner.repository.interface";

describe("CreateBannerUseCase", () => {
  const create = jest.fn((entity: BannerEntity) => Promise.resolve(entity));
  const bannerRepository = { create } as unknown as IBannerRepository;
  const useCase = new CreateBannerUseCase(bannerRepository);

  const base = {
    imageUrl: "https://cdn.ofibites.com/banners/b1.png",
    altText: "Banner de reuniones",
  };

  beforeEach(() => create.mockClear());

  it("persiste el subtitle y lo devuelve en el response", async () => {
    const entity = await useCase.execute({
      ...base,
      title: "Desayunos para tu equipo",
      subtitle: "Ideal para reuniones de 4 a 15 personas",
    });

    const persistida = create.mock.calls[0][0];
    expect(persistida.toPrismaCreate().subtitle).toBe(
      "Ideal para reuniones de 4 a 15 personas",
    );
    expect(entity.subtitle).toBe("Ideal para reuniones de 4 a 15 personas");
  });

  it("sin subtitle se guarda null", async () => {
    await useCase.execute({ ...base });

    expect(create.mock.calls[0][0].toPrismaCreate().subtitle).toBeNull();
  });
});
