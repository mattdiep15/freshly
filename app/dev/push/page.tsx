import { PushSubscribeButton } from "../../_components/PushSubscribeButton";

// TODO(release): replace with designed opt-in
export default function DevPushPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Push test</h1>
      <p>Subscribe this browser to the demo user&apos;s reminders, then open /api/dev/push-test.</p>
      <PushSubscribeButton />
    </main>
  );
}
