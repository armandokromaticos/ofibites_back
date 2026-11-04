import { NotFoundException } from "@nestjs/common";
import { UpdateBannerUseCase } from "./update-banner.use-case";
import { BannerEntity } from "../../../domain/entities/banner.entity";
import type { IBannerRepository } from "../../../domain/repositories/banner.repository.interface";

describe("UpdateBannerUseCase", () => {
  const banner = BannerEntity.fromCreateDto({
    imageUrl: "https://cdn.ofibites.com/banners/b1.png",
    altText: "Banner de reuniones",
    subtitle: "Ideal para reuniones de 4 a 15 personas",
    section: "home-carousel",
    order: 0,
    isActive: true,
  });
  const findUnique = jest.fn();
  const update = jest.fn(() => Promise.resolve(banner));
  const bannerRepository = {
    findUnique,
    update,
  } as unknown as IBannerRepository;
  const useCase = new UpdateBannerUseCase(bannerRepository);

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue(banner);
    update.mockClear();
  });

  it("subtitle null lo borra (data.subtitle = null)", async () => {
    await useCase.execute("banner-1", { subtitle: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: "banner-1" },
      data: { subtitle: null },
    });
  });

  it("actualiza el subtitle cuando viene con texto", async () => {
    await useCase.execute("banner-1", { subtitle: "Nuevo subtítulo" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "banner-1" },
      data: { subtitle: "Nuevo subtítulo" },
    });
  });

  it("si no viene subtitle no lo toca", async () => {
    await useCase.execute("banner-1", { title: "Otro título" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "banner-1" },
      data: { title: "Otro título" },
    });
  });

  it("banner inexistente da 404", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute("no-existe", { subtitle: null }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
