import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { stripe } from "@/libs/stripe";
import { upsertPriceRecord, upsertProductRecord, manageSubscriptionStatusChange } from "@/libs/supabaseAdmin";

const relevantEvents = new Set([
  "product.created",
  "product.updated",
  "price.created",
  "price.updated",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed"
]);

export async function POST(request: Request) {
  const body = await request.text();
  const sig = (await headers()).get("Stripe-Signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      console.error("Missing Stripe signature or webhook secret");
      return new NextResponse("Missing Stripe signature or webhook secret", { status: 400 });
    }
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "product.created":
        case "product.updated":
          await upsertProductRecord(event.data.object as Stripe.Product);
          break;
        case "price.created":
        case "price.updated":
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`Processing subscription event: ${event.type} for subscription ${subscription.id}`);
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === "customer.subscription.created"
          );
          break;
        case "checkout.session.completed":
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === "subscription") {
            console.log(`Processing checkout session completed for subscription: ${checkoutSession.subscription}`);
            await manageSubscriptionStatusChange(
              checkoutSession.subscription as string,
              checkoutSession.customer as string,
              true
            );
          }
          break;
        case "invoice.payment_succeeded":
        case "invoice.payment_failed":
          const invoice = event.data.object as Stripe.Invoice & { subscription: string };
          if (invoice.subscription) {
            console.log(`Processing invoice ${event.type} for subscription: ${invoice.subscription}`);
            await manageSubscriptionStatusChange(
              invoice.subscription,
              invoice.customer as string,
              false
            );
          }
          break;
        default:
          throw new Error(`Unhandled relevant event: ${event.type}`);
      }
    } catch (error) {
      console.error("Webhook handler failed:", error);
      return new NextResponse('Webhook error: "Webhook handler failed. View logs."', { status: 400 });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}