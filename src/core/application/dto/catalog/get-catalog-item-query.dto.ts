import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Lang } from "../../../domain/enums/lang.enum";

export class GetCatalogItemQueryDto {
  @ApiPropertyOptional({ enum: Lang, default: Lang.ES })
  @IsOptional()
  @IsEnum(Lang, { message: "lang solo admite: es, en" })
  lang?: Lang;
}
