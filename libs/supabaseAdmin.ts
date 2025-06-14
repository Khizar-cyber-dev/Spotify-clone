import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types_db";
import { Price, Product } from "@/types";
import { stripe } from "./stripe";
import { toDateTime } from "./helpers";


export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const upsertProductRecord = async (product: Stripe.Product) => {
  const productData: Product = {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? undefined,
    image: product.images?.[0] ?? null,
    metadata: product.metadata,
  };
  const { error } = await supabaseAdmin.from("products").upsert([productData]);
  if (error) {
    throw error;
  }
  console.log(`Product inserted/updated: ${product.id}`);
};

const upsertPriceRecord = async (price: Stripe.Price) => {
  const priceData: Price = {
    id: price.id,
    product_id: typeof price.product === "string" ? price.product : "",
    active: price.active,
    currency: price.currency,
    description: price.nickname ?? undefined,
    type: price.type,
    unit_amount: price.unit_amount ?? undefined,
    interval: price.recurring?.interval,
    interval_count: price.recurring?.interval_count,
    trial_period_days: price.recurring?.trial_period_days,
    metadata: price.metadata,
  };

  const { error } = await supabaseAdmin.from("prices").upsert([priceData]);
  if (error) {
    throw error;
  }

  console.log(`Prices inserted/updated: ${price.id}`);
};

const createOrRetrieveCustomer = async ({ email, uuid }: { email: string; uuid: string }) => {
  const { data, error } = await supabaseAdmin.from("customers").select("stripe_customer_id").eq("id", uuid).single();
  if (error || !data?.stripe_customer_id) {
    const customerData: { metadata: { supabaseUUID: string }; email?: string } = {
      metadata: {
        supabaseUUID: uuid,
      },
    };
    if (email) customerData.email = email;
    const customer = await stripe.customers.create(customerData);
    const { error: supabaseError } = await supabaseAdmin
      .from("customers")
      .insert([{ id: uuid, stripe_customer_id: customer.id }]);
    if (supabaseError) throw supabaseError;
    console.log(`New customer created and inserted for ${uuid}.`);
    return customer.id;
  }
  return data.stripe_customer_id;
};

const copyBillingDetailsToCustomer = async (uuid: string, payment_method: Stripe.PaymentMethod) => {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  if (!name || !phone || !address) return;
  //@ts-ignore
  await stripe.customers.update(customer, { name, phone, address });
  const { error } = await supabaseAdmin
    .from("users")
    .update({
      billing_address: { ...address },
      payment_method: { ...payment_method[payment_method.type] },
    })
    .eq("id", uuid);
  if (error) throw error;
};

const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction = false
) => {
  try {
    console.log('Starting subscription status change for:', subscriptionId);
    
    // Get customer from Supabase
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (customerError || !customerData) {
      console.error('Error fetching customer:', customerError);
      throw new Error('Customer not found');
    }

    // Get subscription from Stripe
    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method']
    });

    if (!subscriptionResponse) {
      console.error('Subscription not found:', subscriptionId);
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionResponse as unknown as Stripe.Subscription & {
      current_period_start: number;
      current_period_end: number;
      trial_start: number | null;
      trial_end: number | null;
    };

    console.log('Retrieved subscription:', {
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_start: subscription.trial_start,
      trial_end: subscription.trial_end
    });

    // For trial subscriptions, use trial dates as period dates
    const periodStart = subscription.status === 'trialing' && subscription.trial_start 
      ? subscription.trial_start 
      : subscription.current_period_start;
    
    const periodEnd = subscription.status === 'trialing' && subscription.trial_end
      ? subscription.trial_end
      : subscription.current_period_end;

    if (!periodStart || !periodEnd) {
      console.error('Missing required period dates:', { periodStart, periodEnd });
      throw new Error('Missing required period dates');
    }

    // Prepare subscription data
    const subscriptionData: Database['public']['Tables']['subscriptions']['Insert'] = {
      id: subscription.id,
      user_id: customerData.id,
      status: subscription.status as Database['public']['Enums']['subscription_status'],
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity || 1,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at ? toDateTime(subscription.cancel_at).toISOString() : null,
      canceled_at: subscription.canceled_at ? toDateTime(subscription.canceled_at).toISOString() : null,
      current_period_start: toDateTime(periodStart).toISOString(),
      current_period_end: toDateTime(periodEnd).toISOString(),
      created: toDateTime(subscription.created).toISOString(),
      ended_at: subscription.ended_at ? toDateTime(subscription.ended_at).toISOString() : null,
      trial_start: subscription.trial_start ? toDateTime(subscription.trial_start).toISOString() : null,
      trial_end: subscription.trial_end ? toDateTime(subscription.trial_end).toISOString() : null
    };

    console.log('Prepared subscription data:', subscriptionData);

    // Upsert subscription data
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert([subscriptionData]);

    if (upsertError) {
      console.error('Error upserting subscription:', upsertError);
      throw upsertError;
    }

    console.log('Successfully updated subscription status');
    return subscriptionData;
  } catch (error) {
    console.error('Error in manageSubscriptionStatusChange:', error);
    throw error;
  }
};

export { upsertProductRecord, upsertPriceRecord, createOrRetrieveCustomer, manageSubscriptionStatusChange };