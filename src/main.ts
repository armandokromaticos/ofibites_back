import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import { AppModule } from "./app.module";
import { ServerTimingInterceptor } from "./server-timing.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });
  // Saltos de proxy de confianza para que req.ip (y el throttler por IP) sea
  // la IP real del cliente. 0 en local; 1 detrás de un proxy/PaaS.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 0);
  // gzip de las respuestas (catálogo, listados): menos bytes entre regiones.
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ServerTimingInterceptor());
  app.setGlobalPrefix("api");
  // CORS_ORIGIN admite varios orígenes separados por coma (dominio de
  // producción + previews de Vercel).
  const corsOrigins = process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors(
    process.env.NODE_ENV === "production"
      ? { origin: corsOrigins, credentials: true }
      : undefined,
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("Ofibites API")
    .setDescription("API B2B de aprovisionamiento corporativo")
    .setVersion("1.0")
    .addTag("Auth", "Autenticación")
    .addTag("Users", "Gestión de usuarios")
    .addTag("Products", "Gestión de productos, tamaños y modificadores")
    .addTag("Combos", "Gestión de combos")
    .addTag("Orders", "Gestión de órdenes")
    .addTag("Banners", "Gestión de banners para carrusel")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
