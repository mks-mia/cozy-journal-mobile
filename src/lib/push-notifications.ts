
import { createClient } from "./supabase";

const supabase = createClient();

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }

  return bytes.buffer;
}

export async function subscribeToPush(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this browser.");
  }

  const publicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"];

  if (!publicKey) {
    throw new Error("VAPID public key is missing.");
  }

  const registration = await navigator.serviceWorker.ready;

  const existingSubscription =
    await registration.pushManager.getSubscription();

  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const subscriptionData = subscription.toJSON();

  const p256dh = subscriptionData.keys?.["p256dh"];
  const auth = subscriptionData.keys?.["auth"];

  if (!subscriptionData.endpoint || !p256dh || !auth) {
    throw new Error("Could not retrieve push subscription details.");
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        p256dh,
        auth,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    throw error;
  }

  return subscription;
}

export async function unsubscribeFromPush(userId: string) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);

  if (error) {
    throw error;
  }

  await subscription.unsubscribe();
}
