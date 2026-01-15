import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './entities/subscription.entity';
import {
  CreateSubscriptionDto,
  TopUpSubscriptionDto,
} from './dto/create-subscription.dto';

@Controller('subscriptions')
@ApiTags('Subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('user/:address')
  @ApiOperation({ summary: 'Get all subscriptions for a user' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns array of subscriptions',
    type: [Subscription],
  })
  async getUserSubscriptions(
    @Param('address') address: string,
  ): Promise<Subscription[]> {
    try {
      return await this.subscriptionsService.getUserSubscriptions(address);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch user subscriptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns subscription details',
    type: Subscription,
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(
    @Param('id') id: number,
  ): Promise<Subscription> {
    try {
      const subscription =
        await this.subscriptionsService.getSubscription(id);

      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      return subscription;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to fetch subscription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/payment-due')
  @ApiOperation({ summary: 'Check if payment is due for a subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether payment is due',
  })
  async isPaymentDue(@Param('id') id: number): Promise<{ isDue: boolean }> {
    try {
      const isDue = await this.subscriptionsService.isPaymentDue(id);
      return { isDue };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to check payment due status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/time-until-payment')
  @ApiOperation({ summary: 'Get time until next payment in seconds' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns seconds until next payment',
  })
  async getTimeUntilPayment(
    @Param('id') id: number,
  ): Promise<{ seconds: number | null }> {
    try {
      const seconds =
        await this.subscriptionsService.getTimeUntilNextPayment(id);
      return { seconds };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get time until payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create')
  @ApiOperation({
    summary: 'Generate unsigned transaction to create a subscription',
  })
  @ApiQuery({
    name: 'address',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns unsigned transaction object',
  })
  async createSubscription(
    @Query('address') address: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<any> {
    try {
      return await this.subscriptionsService.generateCreateSubscriptionTransaction(
        address,
        dto,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate create subscription transaction',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('cancel/:id')
  @ApiOperation({
    summary: 'Generate unsigned transaction to cancel a subscription',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiQuery({
    name: 'address',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns unsigned transaction object',
  })
  async cancelSubscription(
    @Param('id') id: number,
    @Query('address') address: string,
  ): Promise<any> {
    try {
      return await this.subscriptionsService.generateCancelSubscriptionTransaction(
        address,
        id,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate cancel subscription transaction',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('execute/:id')
  @ApiOperation({
    summary: 'Generate unsigned transaction to execute a payment',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiQuery({
    name: 'address',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns unsigned transaction object',
  })
  async executePayment(
    @Param('id') id: number,
    @Query('address') address: string,
  ): Promise<any> {
    try {
      return await this.subscriptionsService.generateExecutePaymentTransaction(
        address,
        id,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate execute payment transaction',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('top-up/:id')
  @ApiOperation({
    summary: 'Generate unsigned transaction to top up a subscription',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiQuery({
    name: 'address',
    description: 'User wallet address',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns unsigned transaction object',
  })
  async topUpSubscription(
    @Param('id') id: number,
    @Query('address') address: string,
    @Body() dto: TopUpSubscriptionDto,
  ): Promise<any> {
    try {
      return await this.subscriptionsService.generateTopUpSubscriptionTransaction(
        address,
        id,
        dto.amount,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate top up subscription transaction',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
