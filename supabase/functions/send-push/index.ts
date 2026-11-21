
import "@supabase/functions-js/edge-runtime.d.ts";

import { withSupabase } from "@supabase/server";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405 },
      );
    }

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT");

    if (!publicKey || !privateKey || !subject) {
      return Response.json(
        { error: "VAPID configuration is incomplete" },
        { status: 500 },
      );
    }

    let requestData: {
      user_id?: string;
      title?: string;
      body?: string;
      url?: string;
    };

    try {
      requestData = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request" },
        { status: 400 },
      );
    }

    const { user_id, title, body, url } = requestData;

    if (
      typeof user_id !== "string" ||
      typeof title !== "string" ||
      typeof body !== "string"
    ) {
      return Response.json(
        { error: "Missing or invalid notification details" },
        { status: 400 },
      );
    }

    const vapid: VapidKeys = {
      subject,
      publicKey,
      privateKey,
    };

    const { data: subscriptions, error } = await ctx.supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) {
      console.error("Subscription lookup failed:", error);

      return Response.json(
        { error: "Could not retrieve subscriptions" },
        { status: 500 },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({
        message: "No push subscriptions found",
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const row of subscriptions) {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      try {
        const payload = await buildPushPayload(
          {
            data: {
              title,
              body,
              url: url || "/",
            },
            options: {
              ttl: 3600,
            },
          },
          subscription,
          vapid,
        );

        const response = await fetch(row.endpoint, payload);

        if (response.ok) {
          sent++;
        } else if (
          response.status === 404 ||
          response.status === 410
        ) {
          await ctx.supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);

          failed++;
        } else {
          console.error(
            "Push delivery failed:",
            response.status,
          );

          failed++;
        }
      } catch (error) {
        console.error("Push sending error:", error);
        failed++;
      }
    }

    return Response.json({
      message: "Push delivery completed",
      sent,
      failed,
    });
  }),
};
