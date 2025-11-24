
type Props = { onOpen?: () => void };

export default function CallChatButton({ onOpen }: Readonly<Props>) {
  const handle = () => {
    globalThis.dispatchEvent(new CustomEvent('open-chat-drawer'));
    onOpen?.();
  };
  return (
    <button className="px-3 py-2 rounded-md border" onClick={handle}>
      Chat
    </button>
  );
}
