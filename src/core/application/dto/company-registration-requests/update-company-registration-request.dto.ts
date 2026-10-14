import { ApiPropertyOptional } from "@nestjs/swagger";
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
  ValidateIf,
} from "class-validator";
import { RegistrationSolution } from "../../../domain/enums/registration-solution.enum";
import { OrderFrequency } from "../../../domain/enums/order-frequency.enum";
import { PeoplePerOrderRange } from "../../../domain/enums/people-per-order-range.enum";
import { trimStringValue } from "../../shared/trim-string.transform";

/**
 * Campo opcional en el PATCH que no admite `null`: solo se omite la
 * validación si no llega (`undefined`). Con `@IsOptional()` un `null` pasaría
 * y acabaría en `.trim()` sobre null (500) o guardado en una columna obligatoria.
 */
const definedOnly = (_: object, value: unknown) => value !== undefined;

export class UpdateCompanyRegistrationRequestDto {
  @ApiPropertyOptional({ example: "Diageo Venezuela C.A." })
  @ValidateIf(definedOnly)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: "J-12345678-9" })
  @ValidateIf(definedOnly)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: "María Pérez" })
  @ValidateIf(definedOnly)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  contactName?: string;

  @ApiPropertyOptional({ example: "maria.perez@diageo.com" })
  @ValidateIf(definedOnly)
  @IsEmail()
  @MaxLength(150)
  contactEmail?: string;

  @ApiPropertyOptional({ example: "+58 412 555 0000" })
  @ValidateIf(definedOnly)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({
    example: "Gerente de Compras",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;

  @ApiPropertyOptional({
    example: 250,
    minimum: 1,
    maximum: 1_000_000,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  employeeCount?: number | null;

  @ApiPropertyOptional({
    example: "Coffee break para reuniones de directorio.",
    maxLength: 500,
  })
  @Transform(trimStringValue)
  @ValidateIf(definedOnly)
  @IsString({ message: "generalNeed debe ser texto" })
  @IsNotEmpty({ message: "generalNeed no puede estar vacío" })
  @MaxLength(500, { message: "generalNeed admite como máximo 500 caracteres" })
  generalNeed?: string;

  @ApiPropertyOptional({
    enum: RegistrationSolution,
    isArray: true,
    example: [RegistrationSolution.WORKING_LUNCH],
  })
  @ValidateIf(definedOnly)
  @IsArray({ message: "interestedSolutions debe ser un arreglo" })
  @ArrayMinSize(1, {
    message: "interestedSolutions debe tener al menos una solución",
  })
  @ArrayUnique({ message: "interestedSolutions no admite valores repetidos" })
  @IsEnum(RegistrationSolution, {
    each: true,
    message: `interestedSolutions solo admite: ${Object.values(RegistrationSolution).join(", ")}`,
  })
  interestedSolutions?: RegistrationSolution[];

  @ApiPropertyOptional({
    enum: OrderFrequency,
    example: OrderFrequency.WEEKLY,
  })
  @ValidateIf(definedOnly)
  @IsEnum(OrderFrequency, {
    message: `orderFrequency solo admite: ${Object.values(OrderFrequency).join(", ")}`,
  })
  orderFrequency?: OrderFrequency;

  @ApiPropertyOptional({
    enum: PeoplePerOrderRange,
    example: PeoplePerOrderRange.FROM_26_TO_50,
  })
  @ValidateIf(definedOnly)
  @IsEnum(PeoplePerOrderRange, {
    message: `peoplePerOrder solo admite: ${Object.values(PeoplePerOrderRange).join(", ")}`,
  })
  peoplePerOrder?: PeoplePerOrderRange;

  @ApiPropertyOptional({
    example: "Preferimos opciones sin gluten.",
    maxLength: 1000,
    nullable: true,
  })
  @Transform(trimStringValue)
  @IsOptional()
  @IsString({ message: "additionalComments debe ser texto" })
  @MaxLength(1000, {
    message: "additionalComments admite como máximo 1000 caracteres",
  })
  additionalComments?: string | null;
}
