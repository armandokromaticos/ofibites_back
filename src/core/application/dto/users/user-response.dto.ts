import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "../../../domain/enums/role.enum";

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  authId: string | null;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  phone: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: "date",
    example: "2000-03-15",
  })
  birthDate: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: "date-time",
    description:
      "Última vez que cambió o restableció su contraseña. Nulo si nunca lo hizo desde que existe el dato.",
  })
  passwordChangedAt: Date | null;
}
