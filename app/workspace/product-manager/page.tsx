"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  Trash2, // ⬅️ add this
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
interface ZuoraStep {
  id: string;
  type: string; // e.g. "product", "rateplan", "rateplancharge"
  title: string; // UI title (derived from type)
  description: string; // UI description
  json: string; // JSON string of payload
  error?: string | null; // backend/LLM error, if any
  jsonError?: string | null; // local JSON parse error when editing
  expanded: boolean; // for collapsible cards
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

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-8 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium transition-all ${
        type === "error" ? "bg-red-600" : "bg-green-600"
      }`}
    >
      {message}
    </div>
  );
}

interface ChatHistorySidebarProps {
  conversations: StoredConversationSummary[];
  activeConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onStartAction: (action: Exclude<ConversationFlow, "idle">) => void; // ⬅️ ADD THIS
}

function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onStartAction, // ⬅️ ADD THIS
}: ChatHistorySidebarProps) {
  return (
    <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white/80 p-3 md:flex">
      {/* CHAT HISTORY - 40% HEIGHT */}
      <div className="flex flex-col h-[40vh]">
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

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
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
              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition ${
                conv.id === activeConversationId
                  ? "bg-slate-900 text-white"
                  : "bg-transparent text-gray-800 hover:bg-gray-100"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
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
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }
                }}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-900/10 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SUGGESTED ACTIONS - 30% HEIGHT */}
      <div className="h-[40vh] mt-4 overflow-y-auto">
        <p className="mb-3 text-sm font-medium text-gray-700">
          Suggested Actions
        </p>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-gray-200 bg-white hover:border-[#2B6CF3] hover:bg-blue-50"
            onClick={() => onStartAction("create-product")}
          >
            <Package className="h-4 w-4 text-[#2B6CF3]" />
            <span className="text-sm">Create Product</span>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-gray-200 bg-white hover:border-[#2B6CF3] hover:bg-blue-50"
            onClick={() => onStartAction("update-product")}
          >
            <Edit className="h-4 w-4 text-[#2B6CF3]" />
            <span className="text-sm">Update Product</span>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-gray-200 bg-white hover:border-[#2B6CF3] hover:bg-blue-50"
            onClick={() => onStartAction("expire-product")}
          >
            <Clock className="h-4 w-4 text-[#2B6CF3]" />
            <span className="text-sm">Expire Product</span>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-gray-200 bg-white hover:border-[#2B6CF3] hover:bg-blue-50"
            onClick={() => onStartAction("view-product")}
          >
            <Eye className="h-4 w-4 text-[#2B6CF3]" />
            <span className="text-sm">View Product</span>
          </Button>
        </div>
      </div>

      {/* EMPTY SPACE - 30% HEIGHT */}
      <div className="h-[10vh]"></div>
    </aside>
  );
}

// ---- Helper to map zuora_api_payloads → individual step payloads ----
const mapZuoraApiPayloadsToSteps = (apiResponse: {
  zuora_api_payloads?: ZuoraPayloadItem[];
}) => {};

export default function WorkflowPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectedCard, setShowConnectedCard] = useState(false);
  const [zuoraSteps, setZuoraSteps] = useState<ZuoraStep[]>([]);
  // Stores the array [{ zuora_api_type, payload }]
  const [persistedZuoraPayloads, setPersistedZuoraPayloads] = useState<
    ZuoraPayloadItem[]
  >([]);
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

  const handleDeleteConversation = (id: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Delete this chat? This action cannot be undone."
      );
      if (!confirmed) return;
    }

    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);

    // remove stored messages
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`${CHAT_MESSAGES_KEY_PREFIX}:${id}`);
      }
    } catch {
      // ignore
    }

    // if we deleted the active chat, move to another or create fresh
    if (activeConversationId === id) {
      if (remaining.length > 0) {
        const next = remaining[0];
        handleSelectConversation(next.id);
      } else {
        handleNewConversation();
      }
    }
  };

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
  const productConsoleLink = executionResult?.productId
    ? getZuoraProductUrl(environment, executionResult.productId)
    : null;

  function getZuoraProductUrl(env: string, productId?: string | null) {
    if (!productId) return null;

    switch (env) {
      case "api-sandbox":
        return `https://apisandbox.zuora.com/apps/Product.do?method=view&id=${productId}`;
      case "sandbox":
        return `https://sandbox.zuora.com/apps/Product.do?method=view&id=${productId}`;
      case "production":
        return `https://www.zuora.com/apps/Product.do?method=view&id=${productId}`;
      default:
        return null;
    }
  }

  const handleHomeClick = () => {
    const confirmLeave = window.confirm(
      "Zuora connection will be disconnected. Do you want to proceed?"
    );

    if (!confirmLeave) return;

    // clear connection state before leaving
    setIsConnected(false);
    setTokenInfo(null);
    router.push("/");
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm Zia — your AI configuration assistant. Let's connect to Zuora and manage your Product Catalog.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ---- Multi-step preview state ----
  const [showPayload, setShowPayload] = useState(false);

  const [expandStep1, setExpandStep1] = useState(true);
  const [expandStep2, setExpandStep2] = useState(true);
  const [expandStep3, setExpandStep3] = useState(true);

  const [step1ProductJson, setStep1ProductJson] = useState<string>("{}");
  const [step2RatePlanJson, setStep2RatePlanJson] = useState<string>("{}");
  const [step3ChargeJson, setStep3ChargeJson] = useState<string>("");

  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  const [preparedPayloads, setPreparedPayloads] = useState<{
    step1: any | null;
    step2: any | null;
    step3: any | null;
  }>({
    step1: null,
    step2: null,
    step3: null,
  });

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
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  // [CHAT-API] Persona + Conversation ID
  const CHAT_API_URL =
    "https://7ajwemkf19.execute-api.us-east-2.amazonaws.com/demo/chat";
  const CHAT_PERSONA = "ProductManager";

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

  const actionPromptMap: Record<Exclude<ConversationFlow, "idle">, string> = {
    "create-product": "I want to create a product.",
    "update-product": "I want to update an existing product.",
    "expire-product": "I want to expire a product by setting an end date.",
    "view-product": "I want to view product details from my catalog.",
  };

  const startActionWithChat = (action: Exclude<ConversationFlow, "idle">) => {
    handleQuickAction(action);
    if (!isConnected) return;

    const userPrompt = actionPromptMap[action];
    if (!userPrompt) return;

    addUserMessage(userPrompt);
    sendChatToApi(userPrompt);
  };

  // [CHAT-API] Send user message to backend and append assistant reply

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
          zuora_api_payloads: persistedZuoraPayloads,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // leave data as {}
      }

      // --------- Main reply text ---------
      const reply: string =
        data?.answer ??
        data?.reply ??
        data?.message ??
        data?.assistant ??
        data?.content ??
        (res.ok
          ? "(No reply content)"
          : `Error: ${res.status} ${res.statusText}`);

      // --------- Conversation id round-trip ---------
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

      // --------- Compact citation suffix (optional) ---------
      let citationsSuffix = "";
      if (Array.isArray(data?.citations) && data.citations.length > 0) {
        const firstThree = data.citations.slice(0, 3);
        const labels = firstThree.map((c: any) => c?.title || c?.id).join(", ");
        const more =
          data.citations.length > 3
            ? ` +${data.citations.length - 3} more`
            : "";
        citationsSuffix = `\n\n— sources: ${labels}${more}`;
      }

      // ======================================================
      //  DYNAMIC ZUORA PAYLOAD STEPS (NO HARDCODED 3 STEPS)
      // ======================================================
      if (
        Array.isArray(data?.zuora_api_payloads) &&
        data.zuora_api_payloads.length > 0
      ) {
        setPersistedZuoraPayloads(data.zuora_api_payloads);

        const items = data.zuora_api_payloads as ZuoraPayloadItem[];

        const makeTitle = (t: string, i: number) => {
          switch (t) {
            case "product":
              return `Step ${i} — Create Product`;
            case "rateplan":
              return `Step ${i} — Create Rate Plan`;
            case "rateplancharge":
              return `Step ${i} — Create Rate Plan Charge`;
            default:
              return `Step ${i} — ${t || "Zuora Call"}`;
          }
        };

        const makeDescription = (t: string) => {
          switch (t) {
            case "product":
              return "Zuora call to create the Product object.";
            case "rateplan":
              return "Zuora call to create a Product Rate Plan for the product.";
            case "rateplancharge":
              return "Zuora call to create a Rate Plan Charge under the rate plan.";
            default:
              return "";
          }
        };

        const newSteps: ZuoraStep[] = items.map((item, index) => ({
          id: `${Date.now()}-${index}`,
          type: item.zuora_api_type || "step",
          title: makeTitle(item.zuora_api_type || "step", index + 1),
          description: makeDescription(item.zuora_api_type || "step"),
          json: JSON.stringify(item.payload ?? {}, null, 2),
          error: null,
          expanded: true,
        }));

        // Store for the dynamic preview cards
        setZuoraSteps(newSteps);
        setShowPayload(true);

        // Optional: keep first product / rateplan / charge in legacy preparedPayloads
        const firstProduct =
          items.find((x) => x.zuora_api_type === "product")?.payload ?? null;
        const firstRatePlan =
          items.find((x) => x.zuora_api_type === "rateplan")?.payload ?? null;
        const firstCharge =
          items.find((x) => x.zuora_api_type === "rateplancharge")?.payload ??
          null;

        setPreparedPayloads({
          step1: firstProduct,
          step2: firstRatePlan,
          step3: firstCharge,
        });

        addAssistantMessage(
          `I generated ${newSteps.length} Zuora API payload step${
            newSteps.length > 1 ? "s" : ""
          }. You can review and edit them in the workspace preview.`,
          200
        );
      }

      // --------- Append assistant reply to chat ---------
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
        setToastMessage({
          message: `Connection failed: ${reason}`,
          type: "error",
        });

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
      setToastMessage({
        message: "Successfully connected to Zuora!",
        type: "success",
      });

      addAssistantMessage(
        "Great! You're now connected. What would you like to do first — Create, Update, Expire, or View a product?",
        600
      );
    } catch (e: any) {
      setIsConnected(false);
      setTokenInfo(null);
      setToastMessage({
        message: e.message || "Unexpected error occurred",
        type: "error",
      });
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
      setExpireProductStep("identify");
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

    if (typeof window === "undefined") return;
    const key = storageKeyForPersona(CHAT_PERSONA);
    sessionStorage.setItem(key, freshId);

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
    setPreparedPayloads({ step1: null, step2: null, step3: null });
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
        const stored = localStorage.getItem(
          `${CHAT_MESSAGES_KEY_PREFIX}:${id}`
        );
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
    setPreparedPayloads({ step1: null, step2: null, step3: null });
  };

  // [CHAT-API] integrate API call on submit
  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    const input = chatInput.trim();
    addUserMessage(input);

    if (currentFlow === "create-product") {
      handleCreateProductFlow(input);
    } else if (currentFlow === "update-product") {
      handleUpdateProductFlow(input);
    } else if (currentFlow === "expire-product") {
      handleExpireProductFlow(input);
    } else if (currentFlow === "view-product") {
      handleViewProductFlow(input);
    }

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
    // you can wire your conversational create-product wizard here if needed
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
          setToastMessage({
            message: "Product expired successfully",
            type: "success",
          });

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

  // Manual “Preview Payloads” from productData (fallback if no LLM payload)
  const handleGeneratePayload = () => {
    // simple defaults based on current productData
    const step1 = {
      Name: productData.name || "New Product",
      SKU: productData.sku || "PRO-STARTER-001",
      Description: productData.description || "",
      EffectiveStartDate:
        productData.startDate || new Date().toISOString().split("T")[0],
      EffectiveEndDate: "2099-12-31",
    };

    const step2 = {
      Name: productData.ratePlans[0]?.name || "Base",
      Description: productData.ratePlans[0]?.description || "",
      ProductId: "@{Product.Id}",
    };

    const step3 = {
      Name: productData.ratePlans[0]?.charges[0]?.name || "Base Charge",
      ProductRatePlanId: "@{ProductRatePlan.Id}",
      ChargeModel: "FlatFee",
      ChargeType: "Recurring",
      BillingPeriod: "Month",
      BillingTiming: "InAdvance",
      Price: 0,
    };

    setStep1ProductJson(JSON.stringify(step1, null, 2));
    setStep2RatePlanJson(JSON.stringify(step2, null, 2));
    setStep3ChargeJson(JSON.stringify(step3, null, 2));
    setPreparedPayloads({ step1, step2, step3 });
    setShowPayload(true);

    setTimeout(() => {
      addAssistantMessage(
        "Product payloads drafted from your current selections. Review each step before execution."
      );
      setToastMessage({
        message: "Product draft created successfully",
        type: "success",
      });
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
      }, 1500);
    }, 300);
  };

  const handleExecute = async () => {
    if (!clientId || !clientSecret) {
      setToastMessage({
        message: "Client ID/Secret required to create product",
        type: "error",
      });

      addAssistantMessage("Please enter Client ID and Client Secret.");
      return;
    }

    setCreateProductStep("execute");
    setExecuting(true);
    addAssistantMessage("Creating product in Zuora…");

    try {
      let productPayload: any = null;
      let ratePlanPayload: any = null;
      let ratePlanChargePayload: any = null;

      // ───────────────────────────────────────────────
      // 1) DYNAMIC MODE – use zuoraSteps (zuora_api_payloads)
      // ───────────────────────────────────────────────
      if (zuoraSteps.length > 0) {
        const updatedSteps = zuoraSteps.map((s) => ({ ...s }));
        const parsedSteps: { type: string; payload: any }[] = [];
        let hasError = false;

        updatedSteps.forEach((step) => {
          if (!step.json || !step.json.trim()) {
            step.error = "Payload is empty. Please provide valid JSON.";
            hasError = true;
            return;
          }

          try {
            const parsed = JSON.parse(step.json);
            step.error = null;
            parsedSteps.push({ type: step.type, payload: parsed });
          } catch (e: any) {
            step.error = e?.message || "Invalid JSON";
            hasError = true;
          }
        });

        setZuoraSteps(updatedSteps);

        if (hasError) {
          throw new Error(
            "One or more steps contain invalid JSON. Please fix them and try again."
          );
        }

        // Map by type → product / rateplan / rateplancharge
        productPayload =
          parsedSteps.find((s) => s.type === "product")?.payload || null;
        ratePlanPayload =
          parsedSteps.find((s) => s.type === "rateplan")?.payload || null;
        ratePlanChargePayload =
          parsedSteps.find((s) => s.type === "rateplancharge")?.payload || null;

        // Keep for debugging / future reuse
        setPreparedPayloads({
          step1: productPayload,
          step2: ratePlanPayload,
          step3: ratePlanChargePayload,
        });
      } else {
        // ───────────────────────────────────────────────
        // 2) FALLBACK MODE – old 3-step textareas
        // ───────────────────────────────────────────────
        let step1Obj: any = null;
        let step2Obj: any = null;
        let step3Obj: any = null;

        // Step 1: Product
        try {
          step1Obj = JSON.parse(step1ProductJson || "{}");
          setStep1Error(null);
        } catch (e: any) {
          setStep1Error(e.message);
          throw new Error(`Step 1 JSON invalid: ${e.message}`);
        }

        // Step 2: Rate Plan
        try {
          step2Obj = JSON.parse(step2RatePlanJson || "{}");
          setStep2Error(null);
        } catch (e: any) {
          setStep2Error(e.message);
          throw new Error(`Step 2 JSON invalid: ${e.message}`);
        }

        // Step 3: Charge (optional)
        if (step3ChargeJson.trim()) {
          try {
            step3Obj = JSON.parse(step3ChargeJson);
            setStep3Error(null);
          } catch (e: any) {
            setStep3Error(e.message);
            throw new Error(`Step 3 JSON invalid: ${e.message}`);
          }
        } else {
          step3Obj = null;
        }

        productPayload = step1Obj;
        ratePlanPayload = step2Obj;
        ratePlanChargePayload = step3Obj;

        setPreparedPayloads({
          step1: step1Obj,
          step2: step2Obj,
          step3: step3Obj,
        });
      }

      // 3) FINAL PAYLOAD → Lambda
      const payload = {
        clientId,
        clientSecret,
        body: {
          product: productPayload,
          ratePlan: ratePlanPayload,
          ratePlanCharge: ratePlanChargePayload,
        },
      };

      console.log("🔥 FINAL PAYLOAD SENT TO ZUORA LAMBDA:");
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
        /* ignore */
      }

      // =====================================
      // ✅ SUCCESS → STATUS 200 OR 201
      // =====================================
      if (res.status === 200 || res.status === 201) {
        setToastMessage({
          message: data.message || "Operation completed successfully!",
          type: "success",
        });
      } else {
        // =====================================
        // ❌ FAILURE → ANY OTHER STATUS
        // =====================================
        setToastMessage({
          message: data?.error || data?.message || "Operation failed!",
          type: "error",
        });

        throw new Error(
          data?.error || data?.message || `Failed with status ${res.status}`
        );
      }

      // =====================================
      // 🔄 Continue mapping IDs after status check
      // =====================================
      const productId: string | undefined =
        data.productId || data.Id || data.id;

      const ratePlanIds: string[] = [];
      if (Array.isArray(data.ratePlans)) {
        ratePlanIds.push(
          ...data.ratePlans
            .map((rp: any) => rp.Id || rp.id || rp.ratePlanId)
            .filter(Boolean)
        );
      }
      if (data.ratePlanId) ratePlanIds.push(data.ratePlanId);

      const chargeIds: string[] = [];
      if (Array.isArray(data.charges)) {
        chargeIds.push(
          ...data.charges
            .map((ch: any) => ch.Id || ch.id || ch.ratePlanChargeId)
            .filter(Boolean)
        );
      }
      if (data.ratePlanChargeId) chargeIds.push(data.ratePlanChargeId);

      // Save results
      setExecutionResult({
        productId: productId ?? "",
        ratePlanIds,
        chargeIds,
      });

      // Build assistant success message
      let msg =
        data.message ||
        "✅ Product + RatePlans + Charges created successfully!";

      if (productId) msg += `\n\nProduct Id: ${productId}`;
      if (ratePlanIds.length)
        msg += `\nRatePlan Ids:\n- ${ratePlanIds.join("\n- ")}`;
      if (chargeIds.length) msg += `\nCharge Ids:\n- ${chargeIds.join("\n- ")}`;

      addAssistantMessage(msg,200);

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
    setShowPayload(false);
    setPreparedPayloads({ step1: null, step2: null, step3: null });
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-slate-800 text-white">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:text-white"
              onClick={handleHomeClick}
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
            Product Manager
          </h1>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Chat history sidebar */}
        <ChatHistorySidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onStartAction={startActionWithChat}
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
                  setShowPayload(false); // 👈 hide preview panel
                  setZuoraSteps([]); // 👈 clear dynamic steps
                  setExecutionResult(null); // 👈 hides product link button as well
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

              <div className="flex flex-col flex-1 overflow-y-auto space-y-4 px-4 py-6">
                {chatMessages.map((message, index) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={index}
                      className={`flex w-full ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg shadow-sm border ${
                          isUser
                            ? "bg-blue-600 text-white border-blue-700"
                            : "bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                        }`}
                      >
                        {/* USER MESSAGE */}
                        {isUser && (
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                        )}

                        {/* ASSISTANT MESSAGE (HTML) */}
                        {!isUser && (
                          <div
                            className="prose prose-sm max-w-full dark:prose-invert break-all"
                            dangerouslySetInnerHTML={{
                              __html: message.content,
                            }}
                          />
                        )}

                        {/* TIMESTAMP */}
                        <div className="text-xs text-gray-500 mt-2 text-right">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        {/* COPY BUTTON */}
                        <button
                          className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              typeof message.content === "string"
                                ? message.content.replace(/<[^>]*>?/gm, "")
                                : ""
                            );
                            setToastMessage({
                              message: `Copied message`,
                              type: "success",
                            });
                          }}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 6h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {productConsoleLink && (
                <div className="mt-2 flex">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="mt-1 rounded-full border-[#2B6CF3] text-[#2B6CF3] hover:bg-blue-50"
                  >
                    <a
                      href={productConsoleLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open product in Zuora
                    </a>
                  </Button>
                </div>
              )}

              {isTyping && <TypingIndicator />}

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
                          Preview Payloads (3 steps)
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

              {currentFlow === "idle" && !showPayload && <div> </div>}

              {/* {showNewMessagesPill && (
                <button
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-[#2B6CF3] px-4 py-2 text-sm font-medium text-white shadow-lg"
                >
                  <span>New messages</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              )} */}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
            <div className="flex items-end gap-2">
              <Textarea
                ref={chatInputRef as any}
                placeholder="Ask about your catalog setup or type a command…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                rows={1}
                className="w-full resize-none max-h-40 min-h-[44px] rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-[#2B6CF3]"
              />

              <Button
                type="button"
                size="icon"
                onClick={handleChatSubmit}
                disabled={!chatInput.trim()}
                className="mb-1 h-9 w-9 rounded-full bg-[#2B6CF3] hover:bg-[#2456c9] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Try commands: <span className="font-medium">/validate</span>,{" "}
              <span className="font-medium">/catalog status</span>,{" "}
              <span className="font-medium">/sync</span>,{" "}
              <span className="font-medium">/help</span>
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
            <div className="space-y-6">
              {/* 3-step preview (Product, Rate Plan, Charge) */}
              {showPayload && zuoraSteps.length > 0 && (
                <div className="space-y-6">
                  {zuoraSteps.map((step, index) => (
                    <Card key={step.id}>
                      <CardHeader
                        onClick={() =>
                          setZuoraSteps((prev) =>
                            prev.map((s) =>
                              s.id === step.id
                                ? { ...s, expanded: !s.expanded }
                                : s
                            )
                          )
                        }
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>
                              {step.title || `Step ${index + 1}`}
                            </CardTitle>
                            <CardDescription>
                              {step.description}
                            </CardDescription>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              step.expanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </CardHeader>

                      {step.expanded && (
                        <CardContent>
                          {(step.error || step.jsonError) && (
                            <div className="mb-3 rounded-lg border border-red-400 bg-red-50 p-3 text-xs text-red-700">
                              {step.error || step.jsonError}
                            </div>
                          )}

                          <textarea
                            className="h-56 w-full rounded-lg border bg-slate-900 p-4 font-mono text-xs text-green-400"
                            value={step.json}
                            onChange={(e) => {
                              const val = e.target.value;
                              setZuoraSteps((prev) =>
                                prev.map((s) => {
                                  if (s.id !== step.id) return s;
                                  let jsonError: string | null = null;
                                  try {
                                    if (val.trim()) JSON.parse(val);
                                  } catch (err: any) {
                                    jsonError = err.message;
                                  }
                                  return { ...s, json: val, jsonError };
                                })
                              );
                            }}
                          />

                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  setCopying(true);
                                  await navigator.clipboard.writeText(
                                    step.json
                                  );
                                  setToastMessage({
                                    message: `Copied ${
                                      step.title || `step ${index + 1}`
                                    } payload`,
                                    type: "success",
                                  });
                                } catch {
                                  setToastMessage({
                                    message:
                                      "Copy failed. Select and copy manually.",
                                    type: "error",
                                  });
                                } finally {
                                  setCopying(false);
                                }
                              }}
                            >
                              Copy Step {index + 1}
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60"
                      onClick={handleExecute}
                      disabled={
                        executing || zuoraSteps.some((s) => s.jsonError)
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {executing
                        ? "Creating in Zuora…"
                        : "Create product, product rate plan, rate plan charge"}
                    </Button>
                  </div>
                </div>
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
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
