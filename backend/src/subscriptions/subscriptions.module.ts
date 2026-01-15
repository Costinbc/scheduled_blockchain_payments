import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ContractService } from './contract.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, ContractService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
