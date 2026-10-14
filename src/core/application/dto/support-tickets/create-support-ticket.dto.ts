import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSupportTicketDto {
  @ApiPropertyOptional({
    description: "Asunto del reporte (opcional)",
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @ApiProperty({
    description: "Mensaje inicial del reporte para Ofibites",
    maxLength: 2000,
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
