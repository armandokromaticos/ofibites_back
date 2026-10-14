import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { RegistrationSolution } from "../../../domain/enums/registration-solution.enum";
import { OrderFrequency } from "../../../domain/enums/order-frequency.enum";
import { PeoplePerOrderRange } from "../../../domain/enums/people-per-order-range.enum";
import { trimStringValue } from "../../shared/trim-string.transform";

export class CreateCompanyRegistrationRequestDto {
  @ApiProperty({
    example: "Diageo Venezuela C.A.",
    description:
      "Razón social / nombre comercial declarado por el solicitante.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName: string;

  @ApiProperty({ example: "J-12345678-9" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxId: string;

  @ApiProperty({ example: "María Pérez" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  contactName: string;

  @ApiProperty({ example: "maria.perez@diageo.com" })
  @IsEmail()
  @MaxLength(150)
  contactEmail: string;

  @ApiProperty({ example: "+58 412 555 0000" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactPhone: string;

  @ApiPropertyOptional({
    example: "Gerente de Compras",
    description: "Cargo / posición del contacto dentro de la empresa.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({
    example: 250,
    description: "Cantidad aproximada de empleados de la empresa.",
    minimum: 1,
    maximum: 1_000_000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  employeeCount?: number;

  @ApiProperty({
    example: "Coffee break para reuniones de directorio dos veces por semana.",
    description: "Necesidad general del cliente (paso 3 del registro).",
    maxLength: 500,
  })
  @Transform(trimStringValue)
  @IsString({ message: "generalNeed debe ser texto" })
  @IsNotEmpty({ message: "generalNeed no puede estar vacío" })
  @MaxLength(500, { message: "generalNeed admite como máximo 500 caracteres" })
  generalNeed: string;

  @ApiProperty({
    enum: RegistrationSolution,
    isArray: true,
    example: [RegistrationSolution.COFFEE_BREAK, RegistrationSolution.SNACKS],
    description: "Soluciones de interés. Al menos una, sin repetidos.",
  })
  @IsArray({ message: "interestedSolutions debe ser un arreglo" })
  @ArrayMinSize(1, {
    message: "interestedSolutions debe tener al menos una solución",
  })
  @ArrayUnique({ message: "interestedSolutions no admite valores repetidos" })
  @IsEnum(RegistrationSolution, {
    each: true,
    message: `interestedSolutions solo admite: ${Object.values(RegistrationSolution).join(", ")}`,
  })
  interestedSolutions: RegistrationSolution[];

  @ApiProperty({
    enum: OrderFrequency,
    example: OrderFrequency.SEVERAL_TIMES_A_WEEK,
    description: "Frecuencia estimada de pedidos.",
  })
  @IsEnum(OrderFrequency, {
    message: `orderFrequency solo admite: ${Object.values(OrderFrequency).join(", ")}`,
  })
  orderFrequency: OrderFrequency;

  @ApiProperty({
    enum: PeoplePerOrderRange,
    example: PeoplePerOrderRange.FROM_11_TO_25,
    description: "Cantidad aproximada de personas por pedido.",
  })
  @IsEnum(PeoplePerOrderRange, {
    message: `peoplePerOrder solo admite: ${Object.values(PeoplePerOrderRange).join(", ")}`,
  })
  peoplePerOrder: PeoplePerOrderRange;

  @ApiPropertyOptional({
    example: "Preferimos opciones sin gluten.",
    description: "Comentarios adicionales.",
    maxLength: 1000,
  })
  @Transform(trimStringValue)
  @IsOptional()
  @IsString({ message: "additionalComments debe ser texto" })
  @MaxLength(1000, {
    message: "additionalComments admite como máximo 1000 caracteres",
  })
  additionalComments?: string;
}
