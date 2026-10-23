import { Global, Module } from "@nestjs/common";
import { CatalogCacheService } from "./catalog-cache.service";

// Global: la usan los use cases de lectura del catálogo y los repositorios del
// catálogo (registrados en muchos módulos) sobre la misma instancia.
@Global()
@Module({
  providers: [CatalogCacheService],
  exports: [CatalogCacheService],
})
export class CatalogCacheModule {}
