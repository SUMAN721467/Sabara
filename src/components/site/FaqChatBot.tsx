import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, HelpCircle, User, Sparkles, RefreshCw } from "lucide-react";
import roundLogo from "@/assets/round logo.png";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
}

const DEFAULT_FAQS: FAQItem[] = [
  {
    id: "1",
    question: "What materials do you use for your mats?",
    answer: "We use 100% natural and sustainable fibres, including river grass, water hyacinth, jute, and coir, sourced locally from traditional weavers."
  },
  {
    id: "2",
    question: "How long does shipping take?",
    answer: "Standard shipping takes 3-7 business days across India. You will receive a tracking link via email as soon as your order ships."
  },
  {
    id: "3",
    question: "What is your return/refund policy?",
    answer: "We offer a 7-day return policy for unused items in original packaging. If you receive a damaged product, please contact us within 48 hours."
  },
  {
    id: "4",
    question: "Can I customize the size of a mat?",
    answer: "Currently, we only offer the standard sizes listed in our shop. For bulk inquiries or special event requests, please drop us an email at contact.sabara@gmail.com."
  },
  {
    id: "5",
    question: "Are your mats anti-slip?",
    answer: "Yes, our mats have natural grip, and some collections feature a natural rubber backing for extra anti-slip protection."
  }
];

export function FaqChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi there! 👋 Welcome to Sabara FAQ Support. How can we help you today? Select a question below to learn more.",
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [disabledButtons, setDisabledButtons] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch FAQs from Database
  useEffect(() => {
    async function loadFaqs() {
      try {
        const res = await fetch("/api/site-settings?key=faqs");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.value?.faqs && Array.isArray(json.value.faqs) && json.value.faqs.length > 0) {
            setFaqs(json.value.faqs);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load FAQs:", err);
      }
      setFaqs(DEFAULT_FAQS);
      setLoading(false);
    }
    loadFaqs();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleQuestionClick = (faq: FAQItem) => {
    if (disabledButtons || isTyping) return;

    // 1. Add user question message
    const userMsg: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      sender: "user",
      text: faq.question,
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setDisabledButtons(true);
    setIsTyping(true);

    // 2. Simulate typing duration
    setTimeout(() => {
      const botMsg: Message = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: "bot",
        text: faq.answer,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      setDisabledButtons(false);
    }, 600);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome",
        sender: "bot",
        text: "Hi there! 👋 Welcome to Sabara FAQ Support. How can we help you today? Select a question below to learn more.",
        timestamp: new Date()
      }
    ]);
    setIsTyping(false);
    setDisabledButtons(false);
  };

  return (
    <div className="fixed bottom-20 right-6 z-[999] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] sm:h-[530px] max-h-[calc(100vh-180px)] w-[350px] sm:w-[385px] flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3.5 text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border border-primary-foreground/20 bg-primary-foreground/15">
                <img src={roundLogo} alt="Logo" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-primary" />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold leading-none">FAQ Assistant</h3>
                <span className="text-[10px] text-primary-foreground/75 mt-0.5 inline-block">Online • Answers instantly</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleResetChat}
                className="rounded-lg p-1.5 hover:bg-primary-foreground/10 transition-colors text-primary-foreground"
                title="Restart Chat"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 hover:bg-primary-foreground/10 transition-colors text-primary-foreground"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto bg-background/50 p-4 space-y-4 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full items-start gap-2.5 ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "bot" && (
                  <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full overflow-hidden border border-border/30 bg-secondary text-secondary-foreground">
                    <img src={roundLogo} alt="Logo" className="h-full w-full object-cover" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-secondary/60 text-secondary-foreground rounded-tl-none border border-border/30"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.sender === "user" && (
                  <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-primary/20 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex w-full items-start gap-2.5 justify-start">
                <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full overflow-hidden border border-border/30 bg-secondary text-secondary-foreground">
                  <img src={roundLogo} alt="Logo" className="h-full w-full object-cover" />
                </div>
                <div className="bg-secondary/60 text-secondary-foreground rounded-2xl rounded-tl-none px-3.5 py-2.5 border border-border/30">
                  <div className="flex gap-1 items-center h-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Questions Area */}
          <div className="border-t bg-card px-4 py-3 space-y-2 max-h-[140px] overflow-y-auto">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Select a question to ask:
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {loading ? (
                <div className="text-xs text-muted-foreground py-2 animate-pulse">Loading FAQ questions...</div>
              ) : faqs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No FAQs available.</div>
              ) : (
                faqs.map((faq) => (
                  <button
                    key={faq.id}
                    onClick={() => handleQuestionClick(faq)}
                    disabled={disabledButtons || isTyping}
                    className={`inline-flex items-center text-left rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground font-medium transition-all hover:bg-secondary/70 hover:border-primary/40 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {faq.question}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Bottom Simulated Input Bar */}
          <div className="border-t bg-secondary/25 px-4 py-3 flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="Chatbot mode (type disabled)"
              disabled
              className="flex-1 bg-transparent text-xs text-muted-foreground/75 outline-none placeholder:text-muted-foreground/50 cursor-not-allowed select-none"
            />
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground/45 cursor-not-allowed select-none">
              <HelpCircle className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer select-none group relative"
        title={isOpen ? "Close FAQ Support" : "Open FAQ Support"}
      >
        {isOpen ? (
          <X className="h-6 w-6 transition-transform duration-300 rotate-90" />
        ) : (
          <>
            {/* Logo container inside the speech bubble */}
            <div className="h-10 w-10 rounded-full overflow-hidden border border-primary-foreground/10 bg-white flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <img src={roundLogo} alt="Sabara Support Logo" className="h-full w-full object-cover" />
            </div>
            {/* Speech bubble tail */}
            <span className="absolute bottom-[-6px] left-[10px] w-0 h-0 border-r-[14px] border-r-transparent border-t-[14px] border-t-primary" />
            
            {/* Notification Dot */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 border border-primary-foreground">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            </span>
          </>
        )}
      </button>
    </div>
  );
}
