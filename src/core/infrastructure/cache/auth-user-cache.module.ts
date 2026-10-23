import { Global, Module } from "@nestjs/common";
import { AuthUserCacheService } from "./auth-user-cache.service";

// Global: la usan los guards de rol (instanciados en cada feature module) y
// `UserRepository` (registrado en muchos módulos) sobre la misma instancia.
@Global()
@Module({
  providers: [AuthUserCacheService],
  exports: [AuthUserCacheService],
})
export class AuthUserCacheModule {}
