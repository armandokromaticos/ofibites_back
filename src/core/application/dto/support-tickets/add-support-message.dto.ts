import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AddSupportMessageDto {
  @ApiProperty({
    description: "Cuerpo del mensaje del chat",
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Matches(/\S/, { message: "body must contain non-whitespace characters" })
  body: string;
}
