import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateProductSizeDto } from "./create-product-size.dto";
import { UpdateProductSizeDto } from "./update-product-size.dto";

async function servingsErrors(
  cls: typeof CreateProductSizeDto | typeof UpdateProductSizeDto,
  servings: unknown,
): Promise<string[]> {
  const dto = plainToInstance(cls, {
    nameEs: "8 personas",
    price: 34,
    servings,
  });
  const errors = await validate(dto, { whitelist: true });
  return errors
    .filter((error) => error.property === "servings")
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe.each([
  ["CreateProductSizeDto", CreateProductSizeDto],
  ["UpdateProductSizeDto", UpdateProductSizeDto],
] as const)("%s · servings", (_name, cls) => {
  it.each([1, 8, null, undefined])("acepta %p", async (servings) => {
    expect(await servingsErrors(cls, servings)).toEqual([]);
  });

  it("rechaza 0", async () => {
    expect(await servingsErrors(cls, 0)).toEqual([
      "servings debe ser al menos 1",
    ]);
  });

  it("rechaza 1.5", async () => {
    expect(await servingsErrors(cls, 1.5)).toContain(
      "servings debe ser un entero",
    );
  });
});
