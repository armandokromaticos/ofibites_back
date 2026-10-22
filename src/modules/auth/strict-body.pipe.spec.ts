import {
  BadRequestException,
  ValidationPipe,
  type ArgumentMetadata,
} from "@nestjs/common";
import { UpdateMeDto } from "../../core/application/dto/auth/update-me.dto";
import { strictBodyPipe } from "./strict-body.pipe";

describe("strictBodyPipe(UpdateMeDto)", () => {
  const pipe = strictBodyPipe(UpdateMeDto);
  const metadata: ArgumentMetadata = { type: "body", metatype: Object };

  const messagesOf = async (body: unknown): Promise<string[]> => {
    const error: unknown = await pipe
      .transform(body, metadata)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    return response.message;
  };

  it("rechaza campos que no se editan aquí", async () => {
    const messages = await messagesOf({
      name: "Ana",
      email: "otro@empresa.com",
    });
    expect(messages).toEqual(["email no se puede editar aquí"]);
  });

  it("rechaza name null o solo espacios", async () => {
    expect(await messagesOf({ name: null })).toContain("name debe ser texto");
    expect(await messagesOf({ name: "   " })).toContain(
      "name no puede estar vacío",
    );
  });

  it('recorta y convierte "" en null para phone y position', async () => {
    const result = (await pipe.transform(
      { name: "  María Pérez ", phone: "  ", position: " Gerente " },
      metadata,
    )) as UpdateMeDto;

    expect(result).toBeInstanceOf(UpdateMeDto);
    expect(result).toEqual({
      name: "María Pérez",
      phone: null,
      position: "Gerente",
    });
  });

  it("encadenado tras el ValidationPipe global (como en runtime), { name, email } da 400", async () => {
    const globalPipe = new ValidationPipe({ whitelist: true, transform: true });
    const body: unknown = await globalPipe.transform(
      { name: "Ana", email: "otro@empresa.com" },
      metadata,
    );
    // El global no valida metatipo Object: no quita el campo extra.
    expect(body).toEqual({ name: "Ana", email: "otro@empresa.com" });

    expect(await messagesOf(body)).toEqual(["email no se puede editar aquí"]);
  });

  it("deja pasar un cuerpo vacío (el use-case responde 400)", async () => {
    await expect(pipe.transform({}, metadata)).resolves.toEqual({});
  });
});
