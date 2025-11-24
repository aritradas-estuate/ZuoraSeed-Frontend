"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Home,
  Bell,
  HelpCircle,
  User,
  Search,
  Sparkles,
  Package,
  Send,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  Edit,
  Clock,
  Eye,
  AlertCircle,
  FileCode,
  XCircle,
  Zap,
  BookOpen,
  AlertTriangle,
  MessageSquare,
  Plus,
} from "lucide-react";
// import { he } from "date-fns/locale"; // (unused)

type ConversationFlow =
  | "idle"
  | "create-product"
  | "update-product"
  | "expire-product"
  | "view-product";

type CreateProductStep =
  | "name"
  | "sku"
  | "description"
  | "start-date"
  | "add-rate-plan"
  | "rate-plan-name"
  | "rate-plan-description"
  | "add-charges"
  | "charge-type"
  | "charge-fields"
  | "another-charge"
  | "another-rate-plan"
  | "summary"
  | "validation"
  | "execute";

type UpdateProductStep =
  | "identify"
  | "show-summary"
  | "select-attribute"
  | "update-value"
  | "confirm"
  | "execute"
  | "another-attribute";

type ExpireProductStep =
  | "identify"
  | "show-details"
  | "select-method"
  | "set-date"
  | "dependency-check"
  | "confirm"
  | "execute";

type ViewProductStep =
  | "choose-scope"
  | "identify"
  | "show-summary"
  | "select-detail"
  | "show-detail"
  | "another-product";

type ChargeType =
  | "flat-fee"
  | "per-unit"
  | "tiered"
  | "volume"
  | "usage"
  | "one-time"
  | "discount";

interface ChargeData {
  type: ChargeType;
  name: string;
  fields: Record<string, string>;
}

interface RatePlanData {
  name: string;
  description: string;
  charges: ChargeData[];
}
type ZuoraPayloadItem = {
  zuora_api_type: string;
  payload: any;
};

interface ProductData {
  name: string;
  sku: string;
  description: string;
  startDate: string;
  ratePlans: RatePlanData[];
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

interface CompletedFlow {
  id: string;
  type: ConversationFlow;
  title: string;
  timestamp: Date;
  isExpanded: boolean;
  messages: ChatMessage[];
  summary?: string;
}

interface ValidationResult {
  category: string;
  status: "pass" | "fail";
  message: string;
}

// Add types near top of file
type EnvKey = "api-sandbox" | "sandbox" | "production";

interface StoredConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const CHAT_CONVERSATIONS_KEY = "pm_chat_conversations_v1";
const CHAT_MESSAGES_KEY_PREFIX = "pm_chat_messages_v1";

const deriveTitleFromMessages = (messages: ChatMessage[]): string => {
  if (!messages || messages.length === 0) return "New chat";

  // Only consider user messages for title
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "New chat";

  const firstUser = userMessages[0];
  const base = (firstUser.content || "").trim().split("\n")[0];
  if (!base) return "New chat";

  return base.length > 40 ? `${base.slice(0, 40)}…` : base;
};


function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
        <Sparkles className="h-4 w-4 text-[#2B6CF3]" />
      </div>
      <div className="flex-1">
        <div className="rounded-lg rounded-tl-none bg-gray-100 p-4">
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-8 z-50 rounded-lg bg-green-600 px-6 py-3 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}

interface ChatHistorySidebarProps {
  conversations: StoredConversationSummary[];
  activeConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
}

function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
}: ChatHistorySidebarProps) {
  return (
    <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white/80 p-3 md:flex">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Conversations
        </span>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 border-gray-300"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-500">
            Start a new chat to see it here.
          </p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelectConversation(conv.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition ${
              conv.id === activeConversationId
                ? "bg-slate-900 text-white"
                : "bg-transparent text-gray-800 hover:bg-gray-100"
            }`}
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                {conv.title || "New chat"}
              </span>
              <span className="truncate text-[10px] text-gray-500">
                {new Date(conv.updatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function WorkflowPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [zuoraGeneratedBody, setZuoraGeneratedBody] = useState(null);
  const [showConnectedCard, setShowConnectedCard] = useState(false);

  const [environment, setEnvironment] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [currentFlow, setCurrentFlow] = useState<ConversationFlow>("idle");
  const [executing, setExecuting] = useState(false);

  const [createProductStep, setCreateProductStep] =
    useState<CreateProductStep>("name");
  const [highlightConnect, setHighlightConnect] = useState(false);

  const [productData, setProductData] = useState<ProductData>({
    name: "",
    sku: "",
    description: "",
    startDate: "",
    ratePlans: [],
  });

  const [currentRatePlan, setCurrentRatePlan] = useState<RatePlanData>({
    name: "",
    description: "",
    charges: [],
  });

  const [currentCharge, setCurrentCharge] = useState<ChargeData>({
    type: "flat-fee",
    name: "",
    fields: {},
  });

  const [updateProductStep, setUpdateProductStep] =
    useState<UpdateProductStep>("identify");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<string>("");
  const [newAttributeValue, setNewAttributeValue] = useState<string>("");

  const [expireProductStep, setExpireProductStep] =
    useState<ExpireProductStep>("identify");
  const [expireMethod, setExpireMethod] = useState<string>("");
  const [expireDate, setExpireDate] = useState<string>("");

  const [viewProductStep, setViewProductStep] =
    useState<ViewProductStep>("choose-scope");
  const [viewScope, setViewScope] = useState<"specific" | "all">("specific");
  const [viewDetailType, setViewDetailType] = useState<string>("");

  const [copying, setCopying] = useState(false);

  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [executionResult, setExecutionResult] = useState<{
    productId: string;
    ratePlanIds: string[];
    chargeIds: string[];
  } | null>(null);
  const router = useRouter();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [apiPayloadText, setApiPayloadText] = useState<string | null>(null);

  // ---- Conversation ID utilities ----
  const CONV_STORAGE_PREFIX = "pm_conversation_id";

  const sanitizeConvId = (id?: string | null) => {
    if (!id) return null;
    const trimmed = String(id).trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
    // clean up any accidental suffixes like "198"
    return trimmed.replace(/198$/, "");
  };

  const newConversationId = () => {
    const base =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `conv-${base}`;
  };

  const storageKeyForPersona = (persona: string) => {
    const path =
      typeof window !== "undefined" ? window.location.pathname : "root";
    return `${CONV_STORAGE_PREFIX}:${persona}:${path}`;
  };

  const getOrCreateConversationId = (
    persona: string,
    opts?: { forceNew?: boolean }
  ) => {
    if (typeof window === "undefined") {
      // SSR fallback – will be replaced on client
      return `conv-${Date.now()}`;
    }

    const key = storageKeyForPersona(persona);

    // migrate old key if it exists (legacy: "pm_conversation_id")
    const legacy = sanitizeConvId(sessionStorage.getItem("pm_conversation_id"));
    if (legacy) {
      sessionStorage.removeItem("pm_conversation_id");
      sessionStorage.setItem(key, legacy);
    }

    if (opts?.forceNew) {
      const fresh = newConversationId();
      sessionStorage.setItem(key, fresh);
      return fresh;
    }

    const existing = sanitizeConvId(sessionStorage.getItem(key));
    if (existing) return existing;

    const created = newConversationId();
    sessionStorage.setItem(key, created);
    return created;
  };

  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const [completedFlows, setCompletedFlows] = useState<CompletedFlow[]>([]);

  const [isTyping, setIsTyping] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Chat history state
  const [conversations, setConversations] = useState<
    StoredConversationSummary[]
  >([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null);

  // [CHAT-API] Persona + Conversation ID
  const CHAT_API_URL =
    "https://7ajwemkf19.execute-api.us-east-2.amazonaws.com/demo/chat";
  const CHAT_PERSONA = "Architect";

  const [conversationId, setConversationId] = useState<string>(() => {
    return getOrCreateConversationId(CHAT_PERSONA);
  });

  const scrollToBottom = (smooth = true) => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
      return;
    }
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  // Add states
  const [connecting, setConnecting] = useState(false);
  const [errors, setErrors] = useState<{
    environment?: string;
    clientId?: string;
    clientSecret?: string;
  }>({});
  const [tokenInfo, setTokenInfo] = useState<null | {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    baseUrl: string;
    scope?: string | null;
  }>(null);

  // Add a small validator
  const validateConnectForm = () => {
    const next: typeof errors = {};
    if (!environment) next.environment = "Please select an environment.";
    if (!clientId.trim()) next.clientId = "Client ID is required.";
    if (!clientSecret.trim()) next.clientSecret = "Client Secret is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // hydrate chat history & initial active conversation from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initialConvId =
      sanitizeConvId(conversationId) || getOrCreateConversationId(CHAT_PERSONA);
    setConversationId(initialConvId);
    setActiveConversationId(initialConvId);

    let savedConversations: StoredConversationSummary[] = [];
    try {
      const raw = localStorage.getItem(CHAT_CONVERSATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          savedConversations = parsed.filter(
            (c: any) =>
              c &&
              typeof c.id === "string" &&
              typeof c.title === "string" &&
              typeof c.createdAt === "string" &&
              typeof c.updatedAt === "string"
          );
        }
      }
    } catch {
      // ignore parse errors
    }

    const nowIso = new Date().toISOString();
    if (!savedConversations.find((c) => c.id === initialConvId)) {
      savedConversations = [
        {
          id: initialConvId,
          title: "New chat",
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...savedConversations,
      ];
    }
    setConversations(savedConversations);

    // load messages for active conversation
    try {
      const msgsKey = `${CHAT_MESSAGES_KEY_PREFIX}:${initialConvId}`;
      const stored = localStorage.getItem(msgsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const restored: ChatMessage[] = parsed
            .filter(
              (m: any) =>
                m &&
                (m.role === "assistant" || m.role === "user") &&
                typeof m.content === "string" &&
                typeof m.timestamp === "string"
            )
            .map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
            }));
          if (restored.length > 0) {
            setChatMessages(restored);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []); // run once

  // persist conversations list
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        CHAT_CONVERSATIONS_KEY,
        JSON.stringify(conversations)
      );
    } catch {
      // ignore
    }
  }, [conversations]);

  // persist messages for the active conversation + keep titles fresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeConversationId) return;

    try {
      const serialized = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem(
        `${CHAT_MESSAGES_KEY_PREFIX}:${activeConversationId}`,
        JSON.stringify(serialized)
      );

      const title = deriveTitleFromMessages(chatMessages);
      const nowIso = new Date().toISOString();

      setConversations((prev) => {
        if (!prev || prev.length === 0) {
          return [
            {
              id: activeConversationId,
              title,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ];
        }

        const existingIndex = prev.findIndex(
          (c) => c.id === activeConversationId
        );
        const base: StoredConversationSummary =
          existingIndex >= 0
            ? { ...prev[existingIndex] }
            : {
                id: activeConversationId,
                title,
                createdAt: nowIso,
                updatedAt: nowIso,
              };

        base.title = title;
        base.updatedAt = nowIso;

        const others = prev.filter((c) => c.id !== activeConversationId);
        return [base, ...others].sort((a, b) =>
          a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
        );
      });
    } catch {
      // ignore
    }
  }, [chatMessages, activeConversationId]);

  useEffect(() => {
    if (chatContainerRef.current && isUserAtBottom) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
      setShowNewMessagesPill(false);
    } else if (!isUserAtBottom && chatMessages.length > 0) {
      setShowNewMessagesPill(true);
    }
  }, [chatMessages, isUserAtBottom]);

  useEffect(() => {
    if (isConnected && currentFlow === "idle") {
      setShowConnectedCard(true);
      const t = setTimeout(() => setShowConnectedCard(false), 10_000);
      return () => clearTimeout(t);
    }
  }, [isConnected, currentFlow]);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceFromBottom <= 48;
      setIsUserAtBottom(atBottom);
      if (atBottom) setShowNewMessagesPill(false);
    };

    chatContainer.addEventListener("scroll", handleScroll);
    return () => chatContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const addAssistantMessage = (content: string, delay = 300) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content, timestamp: new Date() },
      ]);
      requestAnimationFrame(() => scrollToBottom(true));
    }, delay);
  };

  const addUserMessage = (content: string) => {
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content, timestamp: new Date() },
    ]);
  };

  // Map quick actions → starter prompts for the chat service
  const actionPromptMap: Record<Exclude<ConversationFlow, "idle">, string> = {
    "create-product": "I want to create a product.",
    "update-product": "I want to update an existing product.",
    "expire-product": "I want to expire a product by setting an end date.",
    "view-product": "I want to view product details from my catalog.",
  };

  // Kick off an action and trigger the chat API with a starter prompt
  const startActionWithChat = (action: Exclude<ConversationFlow, "idle">) => {
    // respect your connection guard already in handleQuickAction
    handleQuickAction(action);
    if (!isConnected) return;

    const userPrompt = actionPromptMap[action];
    if (!userPrompt) return;

    // show user's intent in the chat UI
    addUserMessage(userPrompt);

    // call your existing chat API integration
    sendChatToApi(userPrompt);
  };

  // [CHAT-API] Send user message to backend and append assistant reply
  const sendChatToApi = async (message: string) => {
    try {
      setIsTyping(true);
      const safeConvId =
        sanitizeConvId(conversationId) ??
        getOrCreateConversationId(CHAT_PERSONA);

      const res = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: CHAT_PERSONA,
          message,
          conversation_id: safeConvId,
        }),
      });

      // Read as text first (defensive against non-JSON error bodies)
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // leave data as {}
      }

      // Accept common shapes: prefer `answer`, then others
      const reply: string =
        data?.answer ??
        data?.reply ??
        data?.message ??
        data?.assistant ??
        data?.content ??
        (res.ok
          ? "(No reply content)"
          : `Error: ${res.status} ${res.statusText}`);

      // Pick up conversation id if backend returns/changes it
      const returnedConvId =
        data?.conversation_id || data?.conversationId || data?.conv_id;
      if (returnedConvId && returnedConvId !== conversationId) {
        setConversationId(returnedConvId);
        if (typeof window !== "undefined") {
          const key = storageKeyForPersona(CHAT_PERSONA);
          sessionStorage.setItem(key, returnedConvId);
        }
        setActiveConversationId(returnedConvId);
      }

      // Optional: show citations compactly if provided
      let citationsSuffix = "";
      if (Array.isArray(data?.citations) && data.citations.length > 0) {
        const firstThree = data.citations.slice(0, 3);
        const labels = firstThree
          .map((c: any) => c?.title || c?.id)
          .join(", ");
        const more =
          data.citations.length > 3
            ? ` +${data.citations.length - 3} more`
            : "";
        citationsSuffix = `\n\n— sources: ${labels}${more}`;
      }

      // === NEW: If the API returned zuora_api_payloads (array), build preview + product body ===
    
      // === Map zuora_api_payloads → unified createProduct body + preview ===
      const payloadItems: ZuoraPayloadItem[] = Array.isArray(
        data?.zuora_api_payloads
      )
        ? data.zuora_api_payloads
        : [];

      if (payloadItems.length > 0) {
        // Build the body that your Lambda expects (product + ratePlans)
        const unifiedBody = mapZuoraPayloadsToCreateBody(payloadItems);

        // 👉 This is what handleExecute will send as "body"
        setZuoraGeneratedBody(unifiedBody);

        // Preview JSON in the right-side panel
        const pretty = JSON.stringify(unifiedBody, null, 2);
        setApiPayloadText(pretty);

        // Optional: sync basics into UI summary
        setProductData((prev) => ({
          ...prev,
          name: unifiedBody.name || prev.name,
          sku: unifiedBody.productCode || prev.sku,
          description: unifiedBody.description || prev.description,
          startDate: unifiedBody.effectiveStartDate || prev.startDate,
        }));

        addAssistantMessage(
          "I generated product and rate plan payloads for Zuora. Opening preview…",
          200
        );
        handleGeneratePayload();
      }



      // Append the normal assistant reply (with compact citations if any)
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: String(reply) + citationsSuffix,
          timestamp: new Date(),
        },
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach the chat service. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      requestAnimationFrame(() => scrollToBottom(true));
    }
  };

  const ZUORA_ENV_BASE: Record<string, string> = {
    "api-sandbox": "https://rest.test.zuora.com",
    sandbox: "https://rest.test.zuora.com",
    production: "https://rest.zuora.com",
  };

  const ZUORA_TOKEN_URL =
    "https://7ajwemkf19.execute-api.us-east-2.amazonaws.com/demo/zuora-token";

  const handleConnect = async () => {
    if (!validateConnectForm()) {
      addAssistantMessage(
        "Please fix the highlighted errors and try again.",
        200
      );
      return;
    }

    try {
      setConnecting(true);

      const res = await fetch(ZUORA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret,
          environment,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        /* keep empty */
      }

      const accessToken =
        data.accessToken || data.access_token || data.token || null;
      const tokenType = data.tokenType || data.token_type || "Bearer";
      const expiresIn = Number(data.expiresIn ?? data.expires_in ?? 0);
      const baseUrl =
        data.baseUrl ||
        data.base_url ||
        ZUORA_ENV_BASE[environment as keyof typeof ZUORA_ENV_BASE];

      if (!res.ok || !accessToken) {
        const reason =
          data?.error_description ||
          data?.message ||
          data?.error ||
          `${res.status} ${res.statusText}`;
        setIsConnected(false);
        setTokenInfo(null);
        setToastMessage(`Connection failed: ${reason}`);
        addAssistantMessage(
          "I couldn't connect. Please check your credentials and environment.",
          200
        );
        return;
      }

      setIsConnected(true);
      setTokenInfo({
        accessToken,
        tokenType,
        expiresIn,
        baseUrl,
        scope: data.scope ?? null,
      });
      setToastMessage("Successfully connected to Zuora!");
      addAssistantMessage(
        "Great! You're now connected. What would you like to do first — Create, Update, Expire, or View a product?",
        600
      );
    } catch (e: any) {
      setIsConnected(false);
      setTokenInfo(null);
      setToastMessage(`Connection error: ${e?.message ?? "Unexpected error"}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleQuickAction = (action: ConversationFlow) => {
    if (!isConnected && action !== "idle") {
      setHighlightConnect(true);
      setTimeout(() => setHighlightConnect(false), 3000);

      addAssistantMessage(
        "You're not connected yet. Please connect to Zuora first to continue.",
        300
      );
      return;
    }

    setCurrentFlow(action);
    setShowPayload(false);

    const actionNames = {
      "create-product": "Create Product",
      "update-product": "Update Product",
      "expire-product": "Expire Product",
      "view-product": "View Product",
    } as const;

    if (action !== "idle") {
      addAssistantMessage(
        `Understood. Let's start with ${actionNames[action]}. I'm fetching relevant details from Zuora.`,
        300
      );
    }

    if (action === "create-product") {
      setCreateProductStep("name");
    } else if (action === "update-product") {
      setUpdateProductStep("identify");
    } else if (action === "expire-product") {
      // no-op for now
    } else if (action === "view-product") {
      setViewProductStep("choose-scope");
      addAssistantMessage(
        "Would you like to view details of a specific product or all products in the catalog?",
        900
      );
    }
  };

  // NEW: create a fresh conversation
  const handleNewConversation = () => {
    const freshId = newConversationId();

    setConversationId(freshId);
    setActiveConversationId(freshId);

    if (typeof window !== "undefined") {
      const key = storageKeyForPersona(CHAT_PERSONA);
      sessionStorage.setItem(key, freshId);
    }

    const nowIso = new Date().toISOString();
    setConversations((prev) => [
      {
        id: freshId,
        title: "New chat",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...prev,
    ]);

    setChatMessages([
      {
        role: "assistant",
        content:
          "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
        timestamp: new Date(),
      },
    ]);

    // reset flows + workspace state
    setCurrentFlow("idle");
    setCreateProductStep("name");
    setUpdateProductStep("identify");
    setExpireProductStep("identify");
    setViewProductStep("choose-scope");

    setProductData({
      name: "",
      sku: "",
      description: "",
      startDate: "",
      ratePlans: [],
    });
    setCurrentRatePlan({ name: "", description: "", charges: [] });
    setSelectedProduct(null);
    setSelectedAttribute("");
    setNewAttributeValue("");
    setExpireMethod("");
    setExpireDate("");
    setViewScope("specific");
    setViewDetailType("");
    setValidationResults([]);
    setExecutionResult(null);
    setShowPayload(false);
  };

  // NEW: switch to a previous conversation
  const handleSelectConversation = (id: string) => {
    if (id === activeConversationId) return;

    setActiveConversationId(id);
    setConversationId(id);

    if (typeof window !== "undefined") {
      const key = storageKeyForPersona(CHAT_PERSONA);
      sessionStorage.setItem(key, id);
    }

    let restored: ChatMessage[] | null = null;

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`${CHAT_MESSAGES_KEY_PREFIX}:${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            restored = parsed
              .filter(
                (m: any) =>
                  m &&
                  (m.role === "assistant" || m.role === "user") &&
                  typeof m.content === "string" &&
                  typeof m.timestamp === "string"
              )
              .map((m: any) => ({
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp),
              }));
          }
        }
      } catch {
        // ignore
      }
    }

    setChatMessages(
      restored && restored.length
        ? restored
        : [
            {
              role: "assistant",
              content:
                "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
              timestamp: new Date(),
            },
          ]
    );

    // reset flows + workspace state
    setCurrentFlow("idle");
    setCreateProductStep("name");
    setUpdateProductStep("identify");
    setExpireProductStep("identify");
    setViewProductStep("choose-scope");

    setProductData({
      name: "",
      sku: "",
      description: "",
      startDate: "",
      ratePlans: [],
    });
    setCurrentRatePlan({ name: "", description: "", charges: [] });
    setSelectedProduct(null);
    setSelectedAttribute("");
    setNewAttributeValue("");
    setExpireMethod("");
    setExpireDate("");
    setViewScope("specific");
    setViewDetailType("");
    setValidationResults([]);
    setExecutionResult(null);
    setShowPayload(false);
  };

  // [CHAT-API] integrate API call on submit
  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    const input = chatInput.trim();
    addUserMessage(input);

    // Fire product-manager flows (your existing logic)
    if (currentFlow === "create-product") {
      handleCreateProductFlow(input);
    } else if (currentFlow === "update-product") {
      handleUpdateProductFlow(input);
    } else if (currentFlow === "expire-product") {
      handleExpireProductFlow(input);
    } else if (currentFlow === "view-product") {
      handleViewProductFlow(input);
    }

    // Also send every user message to chat API
    void sendChatToApi(input);

    setChatInput("");
    requestAnimationFrame(() => scrollToBottom(true));
  };

  const askChargeFields = (chargeType: ChargeType) => {
    const fieldPrompts: Record<ChargeType, string> = {
      "flat-fee":
        "For Recurring Flat Fee, I need:\n1. Billing Period (Monthly/Quarterly/Annual)\n2. List Price\n3. Currency (USD/EUR/GBP)\n\nProvide as: Monthly, 99.99, USD",
      "per-unit":
        "For Per-Unit pricing, I need:\n1. Billing Period\n2. Per Unit Price\n3. Currency\n\nProvide as: Monthly, 5.00, USD",
      tiered:
        "For Tiered pricing, I need:\n1. Billing Period\n2. Tier structure (e.g., 0-100: $1, 101-500: $0.75)\n3. Currency\n\nProvide tier details:",
      volume:
        "For Volume pricing, I need:\n1. Billing Period\n2. Volume tiers\n3. Currency\n\nProvide volume details:",
      usage:
        "For Usage-based pricing, I need:\n1. Unit of Measure (API Calls, GB, Hours)\n2. Rating Method\n3. Overage model\n\nProvide as: API Calls, Per Unit, Standard",
      "one-time":
        "For One-Time charge, I need:\n1. Amount\n2. Trigger (Contract Effective/Service Activation)\n\nProvide as: 500, Contract Effective",
      discount:
        "For Discount, I need:\n1. Discount Type (Percentage/Fixed)\n2. Discount Value\n3. Duration (months)\n\nProvide as: Percentage, 20, 12",
    };

    addAssistantMessage(fieldPrompts[chargeType]);
  };

  const handleChargeFieldInput = (input: string) => {
    const newCharge: ChargeData = {
      ...currentCharge,
      name: `${currentCharge.type} charge`,
      fields: {
        input: input,
      },
    };

    setCurrentRatePlan((prev) => ({
      ...prev,
      charges: [...prev.charges, newCharge],
    }));

    setCurrentCharge({ type: "flat-fee", name: "", fields: {} });
    setCreateProductStep("another-charge");

    setTimeout(() => {
      addAssistantMessage("Add another charge?");
    }, 300);
  };

  const handleCreateProductFlow = (input: string) => {
    // your flow for create-product can be filled here later
  };

  const handleUpdateProductFlow = (input: string) => {
    if (updateProductStep === "identify") {
      const mockProduct = {
        id: "P-000234",
        name: input,
        sku: "SOLAR-001",
        description: "Solar Plan Basic",
        effectiveStart: "2024-01-01",
        effectiveEnd: "2026-12-31",
        currency: "US, Canada",
      };
      setSelectedProduct(mockProduct);
      setUpdateProductStep("show-summary");

      setTimeout(() => {
        addAssistantMessage(
          `Found product: ${mockProduct.description}\n\nProduct ID: ${mockProduct.id}\nSKU: ${mockProduct.sku}\nEffective Start: ${mockProduct.effectiveStart}\nEffective End: ${mockProduct.effectiveEnd}\nCurrency: ${mockProduct.currency}\n\nWhat would you like to update?`,
          600
        );
      }, 300);
    } else if (updateProductStep === "show-summary") {
      setUpdateProductStep("select-attribute");
      setTimeout(() => {
        addAssistantMessage(
          "Please select what you'd like to update:\n1. Name\n2. SKU\n3. Description\n4. Effective Start Date\n5. Effective End Date\n6. Custom Fields\n7. Product Rate Plans\n\nType the number or name.",
          300
        );
      }, 300);
    } else if (updateProductStep === "select-attribute") {
      const attributeMap: Record<string, string> = {
        "1": "Name",
        "2": "SKU",
        "3": "Description",
        "4": "Effective Start Date",
        "5": "Effective End Date",
        "6": "Custom Fields",
        "7": "Product Rate Plans",
        name: "Name",
        sku: "SKU",
        description: "Description",
        "start date": "Effective Start Date",
        "end date": "Effective End Date",
        "custom fields": "Custom Fields",
        "rate plans": "Product Rate Plans",
      };

      const selected = attributeMap[input.toLowerCase()];
      if (selected) {
        setSelectedAttribute(selected);
        setUpdateProductStep("update-value");
        setTimeout(() => {
          addAssistantMessage(`What's the new value for ${selected}?`, 300);
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Please select a valid option (1-7 or type the attribute name).",
            300
          );
        }, 300);
      }
    } else if (updateProductStep === "update-value") {
      setNewAttributeValue(input);
      setUpdateProductStep("confirm");

      setTimeout(() => {
        addAssistantMessage(
          `⚠️ Note: This change will be effective for new subscriptions only.\n\n✅ Product: ${selectedProduct.description}\n🔁 Change: ${selectedAttribute} → ${input}\n\nDo you want me to proceed with this update?`,
          600
        );
      }, 300);
    } else if (updateProductStep === "confirm") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setUpdateProductStep("execute");
        setTimeout(() => {
          addAssistantMessage("✅ Update submitted successfully.", 600);
          setTimeout(() => {
            addAssistantMessage(
              "Would you like to update another attribute?",
              300
            );
            setUpdateProductStep("another-attribute");
          }, 1200);
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Okay, no changes applied. Would you like to update a different attribute?",
            300
          );
          setUpdateProductStep("another-attribute");
        }, 300);
      }
    } else if (updateProductStep === "another-attribute") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setUpdateProductStep("select-attribute");
        setTimeout(() => {
          addAssistantMessage(
            "Please select what you'd like to update:\n1. Name\n2. SKU\n3. Description\n4. Effective Start Date\n5. Effective End Date\n6. Custom Fields\n7. Product Rate Plans",
            300
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Update complete! What would you like to do next?",
            300
          );
          completeCurrentFlow();
        }, 300);
      }
    }
  };

  const handleExpireProductFlow = (input: string) => {
    if (expireProductStep === "identify") {
      const mockProduct = {
        id: "P-000567",
        name: input,
        sku: "SOLAR-PREM-001",
        description: "Solar Plan Premium",
        effectiveStart: "2024-01-01",
        effectiveEnd: "2027-12-31",
      };
      setSelectedProduct(mockProduct);
      setExpireProductStep("show-details");

      setTimeout(() => {
        addAssistantMessage(
          `Found product: ${mockProduct.description}\n\nProduct ID: ${mockProduct.id}\nEffective Start: ${mockProduct.effectiveStart}\nEffective End: ${mockProduct.effectiveEnd}\n\nWould you like to change its End Date to expire it?`,
          600
        );
      }, 300);
    } else if (expireProductStep === "show-details") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setExpireProductStep("select-method");
        setTimeout(() => {
          addAssistantMessage(
            "Choose expiration method:\n1️⃣ Set a new Effective End Date\n2️⃣ Expire immediately (today's date)\n3️⃣ Schedule for a future date\n\nType 1, 2, or 3.",
            300
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Okay, no changes will be made. Returning to main menu.",
            300
          );
          completeCurrentFlow();
        }, 300);
      }
    } else if (expireProductStep === "select-method") {
      const methodMap: Record<string, string> = {
        "1": "new-date",
        "2": "immediate",
        "3": "scheduled",
      };

      const method = methodMap[input];
      if (method) {
        setExpireMethod(method);

        if (method === "immediate") {
          const today = new Date().toISOString().split("T")[0];
          setExpireDate(today);
          setExpireProductStep("dependency-check");
          setTimeout(() => {
            addAssistantMessage(
              `Setting End Date to today (${today}).\n\nBefore expiring the product, I'll check if there are any active or future-dated rate plans linked to it. Continue even if active rate plans exist?`,
              600
            );
          }, 300);
        } else if (method === "new-date" || method === "scheduled") {
          setExpireProductStep("set-date");
          setTimeout(() => {
            addAssistantMessage(
              "Please provide the date in YYYY-MM-DD format (e.g., 2025-10-30).",
              300
            );
          }, 300);
        }
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Please choose a valid option (1, 2, or 3).",
            300
          );
        }, 300);
      }
    } else if (expireProductStep === "set-date") {
      setExpireDate(input);
      setExpireProductStep("dependency-check");
      setTimeout(() => {
        addAssistantMessage(
          `Setting End Date to ${input}.\n\nBefore expiring the product, I'll check if there are any active or future-dated rate plans linked to it. Continue even if active rate plans exist?`,
          600
        );
      }, 300);
    } else if (expireProductStep === "dependency-check") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setExpireProductStep("confirm");
        setTimeout(() => {
          addAssistantMessage(
            `✅ Product: ${selectedProduct.description}\n🗓️ New Effective End Date: ${expireDate}\n\nDo you confirm this update?`,
            600
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Okay, canceling expiration. No changes applied.",
            300
          );
          completeCurrentFlow();
        }, 300);
      }
    } else if (expireProductStep === "confirm") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setExpireProductStep("execute");
        setTimeout(() => {
          addAssistantMessage("✅ Product expired successfully.", 600);
          setToastMessage("Product expired successfully");
          setTimeout(() => {
            completeCurrentFlow();
          }, 1500);
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage("Okay, no changes applied.", 300);
          completeCurrentFlow();
        }, 300);
      }
    }
  };

  const handleViewProductFlow = (input: string) => {
    if (viewProductStep === "choose-scope") {
      if (input.toLowerCase().includes("specific")) {
        setViewScope("specific");
        setViewProductStep("identify");
        setTimeout(() => {
          addAssistantMessage(
            "Please provide the Product Name, ID, or SKU.",
            300
          );
        }, 300);
      } else if (input.toLowerCase().includes("all")) {
        setViewScope("all");
        setViewProductStep("show-summary");
        setTimeout(() => {
          addAssistantMessage(
            "Here are all products in your catalog:\n\n1. Solar Plan Basic (SOLAR-001)\n2. Solar Plan Premium (SOLAR-PREM-001)\n3. Enterprise SaaS Plan (ENT-SAAS-001)\n\nWould you like to view details of a specific product?",
            600
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Please specify 'specific product' or 'all products'.",
            300
          );
        }, 300);
      }
    } else if (viewProductStep === "identify") {
      const mockProduct = {
        id: "P-000234",
        name: input,
        sku: "SOLAR-PREM-001",
        description: "Solar Plan Premium",
        effectiveStart: "2024-01-01",
        effectiveEnd: "2027-12-31",
        orgUnits: "US, Canada, Europe",
      };
      setSelectedProduct(mockProduct);
      setViewProductStep("show-summary");

      setTimeout(() => {
        addAssistantMessage(
          `Product ID: ${mockProduct.id}\nSKU: ${mockProduct.sku}\nEffective Start: ${mockProduct.effectiveStart}\nEffective End: ${mockProduct.effectiveEnd}\nOrg Units: ${mockProduct.orgUnits}\n\nWould you like to view more details?`,
          600
        );
      }, 300);
    } else if (viewProductStep === "show-summary") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setViewProductStep("select-detail");
        setTimeout(() => {
          addAssistantMessage(
            "What would you like to view?\n1️⃣ Product Info (Name, SKU, Description, Dates)\n2️⃣ Rate Plans & Charges (nested list view)\n3️⃣ Custom Fields\n\nType 1, 2, or 3.",
            300
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Okay. Would you like to view another product or return to the catalog list?",
            300
          );
          setViewProductStep("another-product");
        }, 300);
      }
    } else if (viewProductStep === "select-detail") {
      const detailMap: Record<string, string> = {
        "1": "Product Info",
        "2": "Rate Plans & Charges",
        "3": "Custom Fields",
      };

      const detail = detailMap[input];
      if (detail) {
        setViewDetailType(detail);
        setViewProductStep("show-detail");

        setTimeout(() => {
          if (detail === "Product Info") {
            addAssistantMessage(
              `Product Information:\n\nName: ${selectedProduct.description}\nSKU: ${selectedProduct.sku}\nDescription: Premium solar energy plan with advanced features\nEffective Start: ${selectedProduct.effectiveStart}\nEffective End: ${selectedProduct.effectiveEnd}\n\nWould you like to view another detail type?`,
              600
            );
          } else if (detail === "Rate Plans & Charges") {
            addAssistantMessage(
              `Rate Plans & Charges:\n\n📋 Annual Plan\n  └─ Flat Fee: $999/year\n  └─ Setup Fee: $100 (one-time)\n\n📋 Monthly Plan\n  └─ Per-Unit: $5/unit\n  └─ Usage: $0.10/API call\n\nWould you like to view another detail type?`,
              600
            );
          } else if (detail === "Custom Fields") {
            addAssistantMessage(
              `Custom Fields:\n\nRegion: North America\nTier: Premium\nContract Type: Enterprise\n\nWould you like to view another detail type?`,
              600
            );
          }
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage(
            "Please choose a valid option (1, 2, or 3).",
            300
          );
        }, 300);
      }
    } else if (viewProductStep === "show-detail") {
      if (input.toLowerCase() === "yes" || input.toLowerCase() === "y") {
        setViewProductStep("select-detail");
        setTimeout(() => {
          addAssistantMessage(
            "What would you like to view?\n1️⃣ Product Info\n2️⃣ Rate Plans & Charges\n3️⃣ Custom Fields",
            300
          );
        }, 300);
      } else {
        setViewProductStep("another-product");
        setTimeout(() => {
          addAssistantMessage(
            "Would you like to view another product or return to the catalog list?",
            300
          );
        }, 300);
      }
    } else if (viewProductStep === "another-product") {
      if (
        input.toLowerCase() === "yes" ||
        input.toLowerCase() === "y" ||
        input.toLowerCase().includes("another")
      ) {
        setViewProductStep("identify");
        setTimeout(() => {
          addAssistantMessage(
            "Please provide the Product Name, ID, or SKU.",
            300
          );
        }, 300);
      } else {
        setTimeout(() => {
          addAssistantMessage("Returning to main menu.", 300);
          completeCurrentFlow();
        }, 300);
      }
    }
  };

  const handleGeneratePayload = () => {
    setShowPayload(true);
    setTimeout(() => {
      addAssistantMessage(
        "Product payload generated! Check the workspace panel on the right."
      );
      setToastMessage("Product draft created successfully");
    }, 300);
  };

  const handleValidation = () => {
    setCreateProductStep("validation");
    setTimeout(() => {
      addAssistantMessage("Running validation checks...");

      setTimeout(() => {
        const results: ValidationResult[] = [
          {
            category: "Structure",
            status: "pass",
            message: "All required fields present",
          },
          {
            category: "Business Rules",
            status: "pass",
            message: "Pricing logic validated",
          },
          {
            category: "Tenant Checks",
            status: "pass",
            message: "Compatible with tenant configuration",
          },
        ];
        setValidationResults(results);
        addAssistantMessage(
          "✅ Validation complete! All checks passed. Ready to create in Zuora."
        );
      }, 1500);
    }, 300);
  };

  // Build correct Zuora Product JSON with cleanup
  const buildZuoraBody = () => {
    const raw: any = {
      Name: productData?.name ?? null,
      Description: productData?.description ?? null,
      EffectiveStartDate: productData?.startDate ?? null,
      EffectiveEndDate: "2099-12-31",
      SKU: productData?.sku ?? null,
      ProductRatePlans: (productData?.ratePlans || []).map((rp) => ({
        Name: rp.name,
        Description: rp.description || "",
        ProductRatePlanCharges: (rp.charges || []).map((ch) => ({
          Name: ch.name,
          ChargeType: ch.type,
          Fields: ch.fields || {},
        })),
      })),
    };

    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      if (
        v === null ||
        v === undefined ||
        v === "" ||
        (Array.isArray(v) && v.length === 0)
      ) {
        delete raw[k];
      }
    });

    return raw;
  };

  const handleExecute = async () => {
    if (!clientId || !clientSecret) {
      setToastMessage("Client ID/Secret required to create product");
      addAssistantMessage("Please enter Client ID and Client Secret.");
      return;
    }
  
    if (!zuoraGeneratedBody) {
      setToastMessage("No generated Zuora body found.");
      addAssistantMessage("I could not find the generated product payload.");
      return;
    }
  
    setCreateProductStep("execute");
    setExecuting(true);
    addAssistantMessage("Creating product in Zuora…");
  
    try {
      const payload = {
        clientId,
        clientSecret,
        body: zuoraGeneratedBody, // unified body with product + ratePlans
      };
  
      console.log("🔥 FINAL PAYLOAD SENT TO ZUORA:");
      console.log(JSON.stringify(payload, null, 2));
  
      const res = await fetch(
        "https://7ajwemkf19.execute-api.us-east-2.amazonaws.com/demo/zuora/product",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
  
      const raw = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        /* ignore parse error, will fall back below */
      }
  
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `${res.status}`);
      }
  
      // ---- NEW: map API response → IDs ----
      const productId: string | undefined =
        data.productId || data.Id || data.id;
  
      const ratePlanIds: string[] = Array.isArray(data.ratePlans)
        ? data.ratePlans
            .map((rp: any) => rp.Id || rp.id)
            .filter(Boolean)
        : [];
  
      const chargeIds: string[] = Array.isArray(data.charges)
        ? data.charges
            .map((ch: any) => ch.Id || ch.id)
            .filter(Boolean)
        : [];
  
      // store in state if you want to show in a card later
      setExecutionResult({
        productId: productId ?? "",
        ratePlanIds,
        chargeIds,
      });
  
      // build nice chat message with IDs
      let msg =
        data.message ||
        "✅ Product + RatePlans + Charges created successfully!";
  
      if (productId) {
        msg += `\n\nProduct Id: ${productId}`;
      }
      if (ratePlanIds.length) {
        msg += `\nRatePlan Ids:\n- ${ratePlanIds.join("\n- ")}`;
      }
      if (chargeIds.length) {
        msg += `\nCharge Ids:\n- ${chargeIds.join("\n- ")}`;
      }
  
      addAssistantMessage(msg);
      setToastMessage(data.message || "Product created successfully!");
    } catch (err: any) {
      console.error("Create product error:", err);
      addAssistantMessage("❌ Product creation failed.");
      setToastMessage(err.message ?? "Product creation failed");
    } finally {
      setExecuting(false);
    }
  };
  

  const generateProductPayload = () => {
    const payload = {
      name: productData.name,
      sku: productData.sku,
      description: productData.description,
      effectiveStartDate: productData.startDate,
      category: "Base Products",
      ratePlans: productData.ratePlans.map((rp) => ({
        name: rp.name,
        description: rp.description,
        charges: rp.charges.map((charge) => ({
          type: charge.type,
          name: charge.name,
          ...charge.fields,
        })),
      })),
    };
    return JSON.stringify(payload, null, 2);
  };

  const completeCurrentFlow = () => {
    if (currentFlow === "idle") return;

    const flowTitles = {
      "create-product": "Product Creation Flow",
      "update-product": "Product Update Flow",
      "expire-product": "Product Expiration Flow",
      "view-product": "Product View Flow",
    };

    const flowSummaries = {
      "create-product": `Created product: ${productData.name} (${productData.sku}) with ${productData.ratePlans.length} rate plan(s)`,
      "update-product": `Updated ${selectedAttribute} for ${
        selectedProduct?.description || "product"
      }`,
      "expire-product": `Expired ${
        selectedProduct?.description || "product"
      } with end date ${expireDate}`,
      "view-product": `Viewed details for ${
        selectedProduct?.description || "product"
      }`,
    };

    const completedFlow: CompletedFlow = {
      id: Date.now().toString(),
      type: currentFlow,
      title: (flowTitles as any)[currentFlow] || "Completed Flow",
      timestamp: new Date(),
      isExpanded: false,
      messages: chatMessages.slice(1),
      summary: (flowSummaries as any)[currentFlow],
    };

    setCompletedFlows((prev) => [...prev, completedFlow]);
    setChatMessages([
      {
        role: "assistant",
        content:
          "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
        timestamp: new Date(),
      },
    ]);
    setCurrentFlow("idle");

    setCreateProductStep("name");
    setUpdateProductStep("identify");
    setExpireProductStep("identify");
    setViewProductStep("choose-scope");

    setProductData({
      name: "",
      sku: "",
      description: "",
      startDate: "",
      ratePlans: [],
    });
    setCurrentRatePlan({ name: "", description: "", charges: [] });
    setSelectedProduct(null);
    setSelectedAttribute("");
    setNewAttributeValue("");
    setExpireMethod("");
    setExpireDate("");
    setViewScope("specific");
    setViewDetailType("");
    setValidationResults([]);
    setExecutionResult(null);
  };

  const toggleFlowExpansion = (flowId: string) => {
    setCompletedFlows((prev) =>
      prev.map((flow) =>
        flow.id === flowId ? { ...flow, isExpanded: !flow.isExpanded } : flow
      )
    );
  };

  const catalogData = [
    {
      product: "Enterprise SaaS Plan",
      ratePlan: "Annual Subscription",
      charges: "3 Charges",
      status: "Active",
    },
    {
      product: "Professional Plan",
      ratePlan: "Monthly Subscription",
      charges: "2 Charges",
      status: "Active",
    },
    {
      product: "Starter Plan",
      ratePlan: "Monthly Subscription",
      charges: "1 Charge",
      status: "Draft",
    },
  ];

  const activeConversation =
  conversations.find((c) => c.id === activeConversationId) || null;

const activeChatTitle = activeConversation?.title || "New chat";



const mapZuoraPayloadsToCreateBody = (
  items: ZuoraPayloadItem[]
) => {
  const productItem = items.find(
    (p) => p.zuora_api_type?.toLowerCase() === "product"
  );
  const product = productItem?.payload ?? {};

  const ratePlans = items
    .filter((p) => p.zuora_api_type?.toLowerCase() === "rateplan")
    .map((rp) => {
      const p = rp.payload || {};
      return {
        name: p.name ?? p.Name ?? "",
        chargeModel:
          p.chargeModel ??
          p.ChargeModel ??
          (p.charge_type === "usage" ? "usage" : "recurring"),
        chargeType: p.chargeType ?? p.ChargeType ?? "",
        price: p.price ?? p.Price,
        billingCycle: p.billingCycle ?? p.BillingPeriod,
        billingRule: p.billingRule ?? p.BillingTiming,
        unitOfMeasure:
          p.unitOfMeasure ?? p.UnitOfMeasure ?? p.unit_of_measure ?? "",
        includedUnits: p.includedUnits ?? p.IncludedUnits,
        overagePrice: p.overagePrice ?? p.OveragePrice,
        overageEnabled:
          p.overageEnabled ?? p.OverageEnabled ?? p.overage_enabled,
      };
    });

  return {
    name: product.name ?? product.Name ?? "",
    productCode:
      product.productCode ??
      product.ProductCode ??
      product.SKU ??
      product.sku ??
      "",
    description: product.description ?? product.Description ?? "",
    effectiveStartDate:
      product.effectiveStartDate ??
      product.EffectiveStartDate ??
      product.startDate ??
      "",
    effectiveEndDate:
      product.effectiveEndDate ??
      product.EffectiveEndDate ??
      "2099-12-31",
    currencies:
      product.currencies ??
      product.Currencies ??
      (product.currency ? [product.currency] : []),
    ratePlans,
  };
};

const handleCopyPayload = async () => {
  // Prefer AI-generated preview payload, fallback to local generator
  const text = apiPayloadText ?? generateProductPayload();

  try {
    setCopying(true);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setToastMessage("Copied payload to clipboard");
  } catch (e) {
    setToastMessage("Copy failed. Select and copy manually.");
  } finally {
    setCopying(false);
  }
};


  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-slate-800 text-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:text-white"
              onClick={() => router.push("/")}
              aria-label="Home"
            >
              <Home className="h-5 w-5" />
            </Button>

            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">Zuora Seed</span>
              <Badge className="bg-cyan-500 text-xs font-semibold hover:bg-cyan-500">
                v0
              </Badge>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300">Viewing:</span>
              <Select defaultValue="acme">
                <SelectTrigger className="h-9 w-48 border-gray-600 bg-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acme">ACME Corp Global</SelectItem>
                  <SelectItem value="demo">Demo Workspace</SelectItem>
                </SelectContent>
              </Select>
              <Badge className="bg-green-500 text-xs font-semibold hover:bg-green-500">
                Active
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search Config IDs, Audit Reports..."
                className="h-9 w-64 border-gray-600 bg-slate-700 pl-9 text-white placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-gray-300 hover:text-white"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-300 hover:text-white"
              >
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Page Title */}
      <div className="mb-1 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
          <h1 className="text-base font-semibold text-gray-900">
            Architect 
          </h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* NEW: Chat history sidebar */}
        <ChatHistorySidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
        />

        {/* Left Panel - Chat Assistant */}
        <div
          className="flex w-[38%] flex-col border-r border-gray-200
                  bg-gradient-to-b from-[#F9FAFB] to-white min-h-0"
          style={{ height: "87vh" }}
        >
<div className="border-b border-gray-200 p-6">
  <div className="flex items-center justify-between">
    <div className="flex flex-col">
      <h2 className="max-w-xs truncate text-sm font-semibold text-gray-900">
        {activeChatTitle}
      </h2>
      <span className="text-xs text-gray-500">Chat Assistant</span>
    </div>
    <Button
      variant="ghost"
      size="sm"
      className="text-gray-600 hover:text-gray-900"
      onClick={() => {
        setChatMessages([
          {
            role: "assistant",
            content:
              "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
            timestamp: new Date(),
          },
        ]);
        setCurrentFlow("idle");
        setCompletedFlows([]);
      }}
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  </div>
</div>

          <div
            ref={chatContainerRef}
            className="relative flex-1 overflow-y-auto p-6"
            style={{ overscrollBehavior: "contain", scrollbarGutter: "stable" }}
          >
            <div className="space-y-4">
              {completedFlows.map((flow) => (
                <Card key={flow.id} className="border-green-200 bg-green-50">
                  <CardHeader
                    className="cursor-pointer p-4"
                    onClick={() => toggleFlowExpansion(flow.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <CardTitle className="text-sm font-semibold text-green-900">
                            {flow.title}
                          </CardTitle>
                          {flow.summary && (
                            <p className="text-xs text-green-700">
                              {flow.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-green-600 transition-transform ${
                          flow.isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </CardHeader>
                  {flow.isExpanded && (
                    <CardContent className="space-y-3 border-t border-green-200 p-4">
                      {flow.messages.map((message, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">
                            {message.role === "assistant" ? "Zia:" : "You:"}
                          </span>{" "}
                          {message.content}
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              ))}

              {chatMessages.map((message, index) => (
                <div key={index}>
                  {index > 0 && <div className="my-4 h-px bg-gray-100" />}
                  <div className="flex gap-3">
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <Sparkles className="h-4 w-4 text-[#2B6CF3]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div
                        className={`rounded-lg p-4 ${
                          message.role === "assistant"
                            ? "rounded-tl-none bg-gray-100"
                            : "ml-auto max-w-[80%] rounded-tr-none bg-[#2B6CF3] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-line text-sm">
                          {message.content}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="h-8 w-8 shrink-0" />
                    )}
                  </div>
                </div>
              ))}

              {isTyping && <TypingIndicator />}

              {/* bottom anchor for smooth scroll */}
              <div ref={chatBottomRef} />

              {currentFlow === "create-product" &&
                createProductStep === "name" &&
                !isTyping && (
                  <Card className="border-blue-100 bg-blue-50">
                    <CardContent className="flex items-start gap-3 p-4">
                      <BookOpen className="h-5 w-5 text-[#2B6CF3]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Knowledge Center
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Need help? Check out{" "}
                          <a href="#" className="text-[#2B6CF3] underline">
                            Product Setup Best Practices
                          </a>{" "}
                          or ask me to summarize it.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

              {currentFlow === "create-product" &&
                createProductStep === "summary" && (
                  <Card className="border-[#2B6CF3]">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Product Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium">Name:</span>{" "}
                        {productData.name}
                      </div>
                      <div>
                        <span className="font-medium">SKU:</span>{" "}
                        {productData.sku}
                      </div>
                      <div>
                        <span className="font-medium">Description:</span>{" "}
                        {productData.description}
                      </div>
                      <div>
                        <span className="font-medium">Start Date:</span>{" "}
                        {productData.startDate}
                      </div>
                      {productData.ratePlans.length > 0 && (
                        <div>
                          <span className="font-medium">Rate Plans:</span>{" "}
                          {productData.ratePlans.length}
                          {productData.ratePlans.map((rp, idx) => (
                            <div
                              key={idx}
                              className="ml-4 mt-2 rounded bg-gray-50 p-2"
                            >
                              <div className="font-medium">{rp.name}</div>
                              <div className="text-xs text-gray-600">
                                {rp.charges.length} charge(s)
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 space-y-2">
                        <Button
                          className="w-full bg-[#2B6CF3] hover:bg-[#2456c9]"
                          onClick={handleGeneratePayload}
                        >
                          <FileCode className="mr-2 h-4 w-4" />
                          Preview Payloads
                        </Button>
                        <Button
                          className="w-full bg-transparent"
                          variant="outline"
                          onClick={handleValidation}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          Validate Configuration
                        </Button>
                        <Button
                          className="w-full bg-transparent"
                          variant="outline"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

              {createProductStep === "validation" &&
                validationResults.length > 0 && (
                  <Card className="border-green-200">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Validation Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {validationResults.map((result, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {result.status === "pass" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {result.category}
                            </div>
                            <div className="text-xs text-gray-600">
                              {result.message}
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-60"
                        onClick={handleExecute}
                        disabled={executing}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {executing ? "Creating..." : "Create Product in Zuora"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

              {/* Update Product Flow UI */}
              {currentFlow === "update-product" &&
                updateProductStep === "show-summary" &&
                selectedProduct && (
                  <Card className="border-blue-100 bg-blue-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-blue-900">
                          Product Found
                        </h3>
                      </div>
                      <div>
                        <span className="font-medium">Product Name:</span>{" "}
                        {selectedProduct.name}
                      </div>
                      <div>
                        <span className="font-medium">SKU:</span>{" "}
                        {selectedProduct.sku}
                      </div>
                      <div>
                        <span className="font-medium">Description:</span>{" "}
                        {selectedProduct.description}
                      </div>
                      <div>
                        <span className="font-medium">Effective Start:</span>{" "}
                        {selectedProduct.effectiveStart}
                      </div>
                      <div>
                        <span className="font-medium">Effective End:</span>{" "}
                        {selectedProduct.effectiveEnd}
                      </div>
                      <div>
                        <span className="font-medium">Currency:</span>{" "}
                        {selectedProduct.currency}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {currentFlow === "update-product" &&
                updateProductStep === "confirm" &&
                selectedProduct && (
                  <Card className="border-orange-100 bg-orange-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <h3 className="font-medium text-orange-900">
                          Confirm Update
                        </h3>
                      </div>
                      <div className="text-xs text-orange-800">
                        ⚠️ Note: This change will be effective for new
                        subscriptions only.
                      </div>
                      <div>
                        <span className="font-medium">Product:</span>{" "}
                        {selectedProduct.description}
                      </div>
                      <div>
                        <span className="font-medium">Change:</span>{" "}
                        {selectedAttribute} → {newAttributeValue}
                      </div>
                      <p>Do you want me to proceed with this update?</p>
                    </CardContent>
                  </Card>
                )}

              {/* Expire Product Flow UI */}
              {currentFlow === "expire-product" &&
                expireProductStep === "show-details" &&
                selectedProduct && (
                  <Card className="border-orange-100 bg-orange-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <h3 className="font-medium text-orange-900">
                          Product Found
                        </h3>
                      </div>
                      <div>
                        <span className="font-medium">Product Name:</span>{" "}
                        {selectedProduct.name}
                      </div>
                      <div>
                        <span className="font-medium">SKU:</span>{" "}
                        {selectedProduct.sku}
                      </div>
                      <div>
                        <span className="font-medium">Effective Start:</span>{" "}
                        {selectedProduct.effectiveStart}
                      </div>
                      <div>
                        <span className="font-medium">Effective End:</span>{" "}
                        {selectedProduct.effectiveEnd}
                      </div>
                      <p className="mt-3">
                        Would you like to change its End Date to expire it?
                      </p>
                    </CardContent>
                  </Card>
                )}

              {currentFlow === "expire-product" &&
                expireProductStep === "dependency-check" &&
                selectedProduct && (
                  <Card className="border-green-100 bg-green-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h3 className="font-medium text-green-900">
                          Expiration Settings
                        </h3>
                      </div>
                      <div>
                        <span className="font-medium">Product:</span>{" "}
                        {selectedProduct.description}
                      </div>
                      <div>
                        <span className="font-medium">
                          New Effective End Date:
                        </span>{" "}
                        {expireDate}
                      </div>
                      <p className="mt-3">
                        Before expiring the product, I'll check if there are any
                        active or future-dated rate plans linked to it. Continue
                        even if active rate plans exist?
                      </p>
                    </CardContent>
                  </Card>
                )}

              {currentFlow === "expire-product" &&
                expireProductStep === "confirm" &&
                selectedProduct && (
                  <Card className="border-blue-100 bg-blue-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-blue-900">
                          Confirm Expiration
                        </h3>
                      </div>
                      <div>
                        <span className="font-medium">Product:</span>{" "}
                        {selectedProduct.description}
                      </div>
                      <div>
                        <span className="font-medium">
                          New Effective End Date:
                        </span>{" "}
                        {expireDate}
                      </div>
                      <p className="mt-3">Do you confirm this update?</p>
                    </CardContent>
                  </Card>
                )}

              {/* View Product Flow UI */}
              {currentFlow === "view-product" &&
                viewProductStep === "show-summary" &&
                selectedProduct && (
                  <Card className="border-cyan-100 bg-cyan-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-cyan-600" />
                        <h3 className="font-medium text-cyan-900">
                          Product Details
                        </h3>
                      </div>
                      <div>
                        <span className="font-medium">Product ID:</span>{" "}
                        {selectedProduct.id}
                      </div>
                      <div>
                        <span className="font-medium">SKU:</span>{" "}
                        {selectedProduct.sku}
                      </div>
                      <div>
                        <span className="font-medium">Effective Start:</span>{" "}
                        {selectedProduct.effectiveStart}
                      </div>
                      <div>
                        <span className="font-medium">Effective End:</span>{" "}
                        {selectedProduct.effectiveEnd}
                      </div>
                      <div>
                        <span className="font-medium">Org Units:</span>{" "}
                        {selectedProduct.orgUnits}
                      </div>
                      <p className="mt-3">
                        Would you like to view more details?
                      </p>
                    </CardContent>
                  </Card>
                )}

              {currentFlow === "view-product" &&
                viewProductStep === "show-detail" &&
                selectedProduct && (
                  <Card className="border-purple-100 bg-purple-50">
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-600" />
                        <h3 className="font-medium text-purple-900">
                          {viewDetailType === "Rate Plans & Charges"
                            ? "Rate Plans"
                            : viewDetailType}
                        </h3>
                      </div>
                      <p>Would you like to view another detail type?</p>
                    </CardContent>
                  </Card>
                )}

          

              {showNewMessagesPill && (
                <button
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-[#2B6CF3] px-4 py-2 text-sm font-medium text-white shadow-lg"
                >
                  <span>New messages</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
  <div className="relative">
    <Input
      ref={chatInputRef}
      placeholder="Ask about your catalog setup or type a command…"
      value={chatInput}
      onChange={(e) => setChatInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleChatSubmit();
        }
      }}
      className="w-full pr-11"
    />

    <Button
      type="button"
      size="icon"
      onClick={handleChatSubmit}
      disabled={!chatInput.trim()}
      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2B6CF3] hover:bg-[#2456c9] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Send className="h-4 w-4" />
    </Button>
  </div>

  <p className="mt-2 text-xs text-gray-500">
    Try commands: /validate, /catalog status, /sync, /help
  </p>
</div>

        </div>

        {/* Right Panel - Zuora Workspace */}
        <div
          className="w-[60%] overflow-y-auto p-8"
          style={{ overscrollBehavior: "contain" }}
        >
          {!isConnected ? (
            <div className="mx-auto max-w-2xl">
              <div
                className={`connection-card rounded-lg border bg-white p-8 shadow-sm transition-all duration-500 ${
                  highlightConnect ? "border-gray-200" : "border-gray-200"
                }`}
              >
                <div className="mb-6 flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-[#2B6CF3]" />
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      Connect to Zuora
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Connect your Zuora environment to start managing products
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    {/* Environment */}
                    <Label
                      htmlFor="environment"
                      className="text-sm font-medium text-gray-700"
                    >
                      Environment
                    </Label>
                    <Select value={environment} onValueChange={setEnvironment}>
                      <SelectTrigger
                        id="environment"
                        className={`mt-1.5 ${
                          errors.environment ? "border-red-500" : ""
                        }`}
                      >
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api-sandbox">API Sandbox</SelectItem>
                        <SelectItem value="sandbox">Sandbox / Test</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.environment && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.environment}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Client ID */}
                    <Label
                      htmlFor="clientId"
                      className="text-sm font-medium text-gray-700"
                    >
                      Client ID
                    </Label>
                    <Input
                      id="clientId"
                      type="text"
                      placeholder="Enter your OAuth Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className={`mt-1.5 ${
                        errors.clientId ? "border-red-500" : ""
                      }`}
                    />
                    {errors.clientId && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.clientId}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Client Secret */}
                    <Label
                      htmlFor="clientSecret"
                      className="text-sm font-medium text-gray-700"
                    >
                      Client Secret
                    </Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Enter your OAuth Client Secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className={`mt-1.5 ${
                        errors.clientSecret ? "border-red-500" : ""
                      }`}
                    />
                    {errors.clientSecret && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.clientSecret}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg bg-blue-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      OAuth Endpoints Guide
                    </h3>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>
                        <span className="font-medium">API Sandbox:</span>{" "}
                        https://rest.apisandbox.zuora.com
                      </p>
                      <p>
                        <span className="font-medium">Sandbox/Test:</span>{" "}
                        https://rest.sandbox.zuora.com
                      </p>
                      <p>
                        <span className="font-medium">Production:</span>{" "}
                        https://rest.zuora.com
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleConnect}
                    disabled={
                      connecting || !environment || !clientId || !clientSecret
                    }
                    className="w-full bg-[#2B6CF3] hover:bg-[#2456c9] disabled:opacity-60"
                  >
                    {connecting ? "Connecting…" : "Connect to Zuora"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {showPayload && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Product Payload Preview</CardTitle>
                    <CardDescription>
                      JSON payload ready to send to Zuora API
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-green-400">
                      {apiPayloadText ?? generateProductPayload()}
                    </pre>

                    <div className="mt-4 flex gap-2">
                      <Button
                        className="bg-[#2B6CF3] hover:bg-[#2456c9]"
                        onClick={handleValidation}
                      >
                        Validate & Deploy
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCopyPayload}
                        disabled={copying}
                      >
                        {copying ? "Copying…" : "Copy to Clipboard"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isConnected &&
                showConnectedCard &&
                currentFlow === "idle" &&
                !showPayload && (
                  <div className="mx-auto max-w-2xl">
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-green-900">
                            ✅ Connected to Zuora
                          </h3>
                          <p className="text-sm text-green-700">
                            Environment:{" "}
                            {environment === "api-sandbox"
                              ? "API Sandbox"
                              : environment === "sandbox"
                              ? "Sandbox / Test"
                              : "Production"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
