declare module "midtrans-client" {
  type SnapConfig = {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  };

  type TransactionParameter = {
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    credit_card?: { secure: boolean };
    customer_details?: {
      first_name?: string;
      email?: string;
      phone?: string;
    };
    item_details?: Array<{
      id: string;
      price: number;
      quantity: number;
      name: string;
    }>;
  };

  type TransactionResult = {
    token: string;
    redirect_url: string;
  };

  export class Snap {
    constructor(config: SnapConfig);
    createTransaction(parameter: TransactionParameter): Promise<TransactionResult>;
  }

  export class CoreApi {
    constructor(config: SnapConfig);
    transaction: {
      notification(payload: unknown): Promise<{
        order_id: string;
        transaction_status: string;
        fraud_status?: string;
        signature_key: string;
        status_code: string;
        gross_amount: string;
      }>;
    };
  }

  const midtransClient: { Snap: typeof Snap; CoreApi: typeof CoreApi };
  export default midtransClient;
}
