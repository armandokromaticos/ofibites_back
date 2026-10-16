import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Lang } from "../../../domain/enums/lang.enum";

/** `?lang=es|en` de los endpoints del carrito: idioma de `name` y `sizeLabel`. */
export class CartLangQueryDto {
  @ApiPropertyOptional({ enum: Lang, default: Lang.ES })
  @IsOptional()
  @IsEnum(Lang, { message: "lang solo admite: es, en" })
  lang?: Lang;
}
