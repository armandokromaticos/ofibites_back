import { ApiProperty } from "@nestjs/swagger";

export class ResetMemberPasswordResponseDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    example:
      "Se envió el correo de restablecimiento de contraseña vía Supabase.",
  })
  message: string;
}
