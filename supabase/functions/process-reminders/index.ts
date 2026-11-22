
import "@supabase/functions-js/edge-runtime.d.ts";

import { withSupabase } from "@supabase/server";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";

const SOON_WINDOW_MS = 60 * 60 * 1000;
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

const MINDFUL_PHRASES = [
  "“You do not have to be calm to be kind to yourself.” What's one small thing that steadied you this week?",
  "“Almost everything will work again if you unplug it for a few minutes — including you.” Where could you unplug today?",
  "“Progress is quiet.” What has quietly changed for you lately?",
  "“Feelings are visitors. Let them come and go.” Which one has been visiting most?",
  "“You are allowed to rest without earning it.” When did you last really rest?",
  "“Start where you are, use what you have.” What's the next tiny step you could take?",
  "“Breathe. You've handled harder days than this one.” What's weighing on you right now?",
  "“Comparison is a thief.” What would enough look like for you this fortnight?",
  "“Be gentle with yourself; you're doing the best you can with what you know.” What deserves a bit more kindness?",
  "“Attention is the rarest form of generosity.” What's worth your full attention today?",
];

function getMindfulPhrase(now: number): string {
  const index = Math.floor(now / TWO_WEEKS) % MINDFUL_PHRASES.length;
  return MINDFUL_PHRASES[index]!;
}

function relativeDue(dueAt: number, now: number): string {
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  let span: string;

  if (mins < 1) span = "less than a minute";
  else if (mins < 60) span = `${mins} min`;
  else if (hours < 24) span = `${hours} hour${hours === 1 ? "" : "s"}`;
  else span = `${days} day${days === 1 ? "" : "s"}`;

  return diff < 0 ? `${span} overdue` : `in ${span}`;
}

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

    const vapid: VapidKeys = {
      subject,
      publicKey,
      privateKey,
    };

    const now = Date.now();
    const { data: tasks, error } = await ctx.supabaseAdmin
      .from("tasks")
      .select("id, user_id, title, due_at, completed, notified")
      .eq("completed", false)
      .not("due_at", "is", null)
      .lte("due_at", new Date(now + SOON_WINDOW_MS).toISOString());

    if (error) {
      console.error("Task lookup failed:", error);

      return Response.json(
        { error: "Could not retrieve tasks" },
        { status: 500 },
      );
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const task of tasks ?? []) {
      const dueAt = new Date(task.due_at).getTime();
      const notified: string[] = task.notified ?? [];

      const threshold =
        dueAt <= now
          ? "due"
          : dueAt - now <= SOON_WINDOW_MS
            ? "soon"
            : null;

      if (!threshold || notified.includes(threshold)) continue;

      const { data: claimedTask, error: updateError } =
        await ctx.supabaseAdmin
          .from("tasks")
          .update({ notified: [...notified, threshold] })
          .eq("id", task.id)
          .eq("completed", false)
          .not("notified", "cs", `{${threshold}}`)
          .select("id")
          .maybeSingle();

      if (updateError) {
        console.error("Could not mark task notification:", updateError);
        continue;
      }

      if (!claimedTask) continue;

      processed++;

      const { data: subscriptions, error: subscriptionError } =
        await ctx.supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", task.user_id);

      if (subscriptionError) {
        console.error("Subscription lookup failed:", subscriptionError);
        failed++;
        continue;
      }

      for (const row of subscriptions ?? []) {
        const subscription: PushSubscription = {
          endpoint: row.endpoint,
          expirationTime: null,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        };

        const title =
          threshold === "due"
            ? "Deadline reached"
            : "Deadline coming up";

        const body =
          threshold === "due"
            ? `${task.title} — due now`
            : `${task.title} — ${relativeDue(dueAt, now)}`;

        try {
          const payload = await buildPushPayload(
            {
              data: {
                title,
                body,
                url: "/",
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
            console.error("Push delivery failed:", response.status);
            failed++;
          }
        } catch (error) {
          console.error("Push sending error:", error);
          failed++;
        }
      }
    }


    // Process fortnightly mindfulness notifications.
    const cutoff = new Date(now - TWO_WEEKS).toISOString();

    const { data: mindfulUsers, error: mindfulError } =
      await ctx.supabaseAdmin
        .from("user_settings")
        .select("user_id, mindful_last_notified")
        .or(`mindful_last_notified.is.null,mindful_last_notified.lte.${cutoff}`);

    if (mindfulError) {
      console.error("Mindfulness lookup failed:", mindfulError);
    }

    let mindfulProcessed = 0;
    let mindfulSent = 0;
    let mindfulFailed = 0;

    for (const setting of mindfulUsers ?? []) {
      const { data: subscriptions, error: subscriptionError } =
        await ctx.supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", setting.user_id);

      if (subscriptionError) {
        console.error("Mindfulness subscription lookup failed:", subscriptionError);
        mindfulFailed++;
        continue;
      }

      // Do not advance the schedule if this user has no subscribed device.
      if (!subscriptions || subscriptions.length === 0) continue;

      // Claim this reminder so another scheduled run does not send it again.
      const { data: claimed, error: claimError } =
        await ctx.supabaseAdmin
          .from("user_settings")
          .update({
            mindful_last_notified: new Date(now).toISOString(),
          })
          .eq("user_id", setting.user_id)
          .or(`mindful_last_notified.is.null,mindful_last_notified.lte.${cutoff}`)
          .select("user_id")
          .maybeSingle();

      if (claimError) {
        console.error("Mindfulness schedule update failed:", claimError);
        mindfulFailed++;
        continue;
      }

      if (!claimed) continue;

      mindfulProcessed++;

      const body = getMindfulPhrase(now);

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
                title: "A moment of mindfulness",
                body,
                url: "/",
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
            mindfulSent++;
          } else if (
            response.status === 404 ||
            response.status === 410
          ) {
            await ctx.supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", row.endpoint);

            mindfulFailed++;
          } else {
            console.error("Mindfulness push failed:", response.status);
            mindfulFailed++;
          }
        } catch (error) {
          console.error("Mindfulness push error:", error);
          mindfulFailed++;
        }
      }
    }

    return Response.json({
      message: "Background reminder processing completed",
      tasks: {
        processed,
        sent,
        failed,
      },
      mindfulness: {
        processed: mindfulProcessed,
        sent: mindfulSent,
        failed: mindfulFailed,
      },
    });
  }),
};
