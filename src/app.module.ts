import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./core/infrastructure/database/prisma/prisma.module";
import { SupabaseModule } from "./core/infrastructure/supabase/supabase.module";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProductsModule } from "./modules/products/products.module";
import { CombosModule } from "./modules/combos/combos.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { BannersModule } from "./modules/banners/banners.module";
import { MoodGalleryModule } from "./modules/mood-gallery/mood-gallery.module";
import { TagsModule } from "./modules/tags/tags.module";
import { SectionsModule } from "./modules/sections/sections.module";
import { AgencyCardsModule } from "./modules/agency-cards/agency-cards.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { CompanyAddressesModule } from "./modules/company-addresses/company-addresses.module";
import { CompanyMembersModule } from "./modules/company-members/company-members.module";
import { CompanyRegistrationRequestsModule } from "./modules/company-registration-requests/company-registration-requests.module";
import { CartModule } from "./modules/cart/cart.module";
import { CompanyOnboardingModule } from "./modules/company-onboarding/company-onboarding.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { SupportTicketsModule } from "./modules/support-tickets/support-tickets.module";

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    CombosModule,
    OrdersModule,
    CouponsModule,
    BannersModule,
    MoodGalleryModule,
    TagsModule,
    SectionsModule,
    AgencyCardsModule,
    CompaniesModule,
    BranchesModule,
    DepartmentsModule,
    CompanyAddressesModule,
    CompanyMembersModule,
    CompanyRegistrationRequestsModule,
    CartModule,
    CompanyOnboardingModule,
    DashboardModule,
    InvitationsModule,
    SupportTicketsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  private readonly logger = new Logger("HTTP");

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((request: Request, response: Response, next: NextFunction) => {
        const start = Date.now();
        response.on("finish", () => {
          this.logger.log(
            `${request.method} ${request.originalUrl} ${response.statusCode} - ${Date.now() - start}ms`,
          );
        });
        next();
      })
      .forRoutes("*");
  }
}
