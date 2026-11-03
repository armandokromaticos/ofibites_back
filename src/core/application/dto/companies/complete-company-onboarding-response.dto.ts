import { ApiProperty } from "@nestjs/swagger";

export class CompleteCompanyOnboardingResponseDto {
  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2026-11-03T14:30:00.000Z",
    description:
      "Fecha en que se completó el onboarding (la existente si ya estaba completado).",
  })
  onboardingCompletedAt: string;
}
