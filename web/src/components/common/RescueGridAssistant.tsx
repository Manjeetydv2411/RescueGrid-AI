import { useState, useRef, useEffect, type FormEvent } from "react";
import { assistantApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  "How do I use the Resource Location Picker?",
  "What actions can I perform under my role?",
  "How do I use the Tactical Map and radar?",
  "How do I report an incident?",
];

export const RescueGridAssistant = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello${user ? ` ${user.name}` : ""}! I am your RescueGrid Assistant. Ask me how to use platform features, search addresses with the Location Picker, or understand your ${user?.role || "user"} permissions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      if (typeof messagesEndRef.current.scrollIntoView === "function") {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await assistantApi.chat(query);
      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        sender: "assistant",
        text: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || "Unable to reach the assistant service.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleSend();
  };

  if (!user) return null; // Only authenticated users can access assistant

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open RescueGrid AI Assistant"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-cyber-cyan px-4 py-3 font-mono text-xs font-bold text-tactical-950 shadow-glass hover:bg-cyber-cyan/90 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-tactical-950 animate-pulse" />
          <span>RescueGrid AI Assistant</span>
          <span className="text-base">🤖</span>
        </button>
      )}

      {/* Chat Panel Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="RescueGrid AI Assistant Chat"
          className="fixed bottom-6 right-6 z-50 flex h-[520px] max-h-[85vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-cyber-cyan/40 bg-[#070D1A] shadow-glass overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1F2937] bg-[#111827] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-[#00F0FF] animate-ping" />
              <div>
                <h3 className="font-mono text-xs font-bold tracking-wider text-cyber-cyan">
                  RESCUEGRID ASSISTANT
                </h3>
                <p className="text-[10px] text-platinum-700">
                  Role: <span className="text-emerald-400 font-bold">{user.role}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Assistant"
              className="rounded-lg p-1.5 text-platinum-700 hover:bg-[#1F2937] hover:text-white transition-colors text-xs font-mono font-bold"
            >
              ✕
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0F19]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-cyber-cyan text-tactical-950 font-medium rounded-br-none"
                      : "bg-[#151E2D] border border-[#1F2937] text-platinum-900 rounded-bl-none whitespace-pre-line"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-1 text-[10px] text-platinum-700 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs font-mono text-cyber-cyan bg-[#151E2D] border border-cyber-cyan/20 px-3 py-2 rounded-xl w-fit">
                <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-ping" />
                <span>Thinking...</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-alert-red/40 bg-alert-red/10 px-3 py-2 text-xs text-alert-red font-mono"
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          <div className="border-t border-[#1F2937] bg-[#111827] px-3 py-2 overflow-x-auto flex gap-1.5 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void handleSend(question)}
                disabled={loading}
                className="whitespace-nowrap rounded-lg border border-cyber-cyan/20 bg-[#151E2D] px-2.5 py-1 text-[11px] font-mono text-platinum-800 hover:border-cyber-cyan/60 hover:text-cyber-cyan transition-colors disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-[#1F2937] bg-[#111827] p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how to use RescueGrid..."
              maxLength={1000}
              className="flex-1 rounded-lg border border-[#1F2937] bg-[#070D1A] px-3 py-2 text-xs text-white placeholder-platinum-700 focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-cyber-cyan px-3.5 py-2 font-mono text-xs font-bold text-tactical-950 disabled:opacity-50 hover:bg-cyber-cyan/90 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default RescueGridAssistant;
