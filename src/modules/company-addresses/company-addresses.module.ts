import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CompaniesModule } from "../companies/companies.module";
import { CompanyAddressesController } from "./controllers/company-addresses.controller";
import { COMPANY_ADDRESS_REPOSITORY } from "../../core/domain/repositories/company-address.repository.interface";
import { CompanyAddressRepository } from "../../core/infrastructure/repositories/company-address.repository";
import { ORDER_REPOSITORY } from "../../core/domain/repositories/order.repository.interface";
import { OrderRepository } from "../../core/infrastructure/repositories/order.repository";
import { CreateCompanyAddressUseCase } from "../../core/application/use-cases/company-addresses/create-company-address.use-case";
import { GetCompanyAddressUseCase } from "../../core/application/use-cases/company-addresses/get-company-address.use-case";
import { GetCompanyAddressesUseCase } from "../../core/application/use-cases/company-addresses/get-company-addresses.use-case";
import { UpdateCompanyAddressUseCase } from "../../core/application/use-cases/company-addresses/update-company-address.use-case";
import { DeleteCompanyAddressUseCase } from "../../core/application/use-cases/company-addresses/delete-company-address.use-case";
import { GetCompanyAddressBlockingOrdersUseCase } from "../../core/application/use-cases/company-addresses/get-company-address-blocking-orders.use-case";

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [CompanyAddressesController],
  providers: [
    {
      provide: COMPANY_ADDRESS_REPOSITORY,
      useClass: CompanyAddressRepository,
    },
    // T-31a: GetCompanyAddressBlockingOrdersUseCase necesita leer Order.
    // OrdersModule importa CompanyAddressesModule (no al revés), así que el
    // repositorio se registra aquí, igual que hacen otros feature modules
    // con repos de otros dominios (ver CLAUDE.md "Wiring").
    { provide: ORDER_REPOSITORY, useClass: OrderRepository },
    CreateCompanyAddressUseCase,
    GetCompanyAddressUseCase,
    GetCompanyAddressesUseCase,
    UpdateCompanyAddressUseCase,
    DeleteCompanyAddressUseCase,
    GetCompanyAddressBlockingOrdersUseCase,
  ],
  exports: [COMPANY_ADDRESS_REPOSITORY],
})
export class CompanyAddressesModule {}
