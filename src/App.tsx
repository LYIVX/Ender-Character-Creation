import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { applySheetSnapshot, getSheetSnapshot, initSheet, resetSheetToDefaults } from "./sheet";
import { open as openExternal } from "@tauri-apps/api/shell";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import {
  isEntitledForApp,
  openAppBrowser,
  readSharedPreferences,
  refreshLaunchToken,
  writeSharedPreferences,
  type LaunchToken,
} from "@enderfall/runtime";
import { AccessGate, Button, Dropdown, Input, MainHeader, Panel, PreferencesModal, Select, Slider, Textarea, Toggle, applyTheme, getStoredTheme } from "@enderfall/ui";

type ThemeMode = "galaxy" | "atelier" | "system" | "light" | "plain-light" | "plain-dark";
type SheetTab = {
  id: string;
  title: string;
  data: ReturnType<typeof getSheetSnapshot> | null;
  relationships: Record<RelationshipTab, RelationshipEntry[]>;
  relationshipSelection: Record<RelationshipTab, string | null>;
};

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System (Default)" },
  { value: "galaxy", label: "Galaxy (Dark)" },
  { value: "atelier", label: "Atelier" },
  { value: "light", label: "Galaxy (Light)" },
  { value: "plain-light", label: "Plain Light" },
  { value: "plain-dark", label: "Plain Dark" },
];

const isTauri = typeof window !== "undefined" && "__TAURI_IPC__" in window;
const appId = "character-creation-sheet";

const IconChevronDown = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 9l6 6 6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6l-12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const noteOptions = [
  "Personality",
  "Hobbies",
  "Food-Related",
  "Habits",
  "Quirks",
  "Extras",
];

type RelationshipTab = "family" | "friends" | "love" | "hate";

type RelationshipEntry = {
  id: string;
  name: string;
  portrait: string | null;
  relation?: string;
  sourceFile?: string;
  addedAt: number;
};

const createRelationshipDefaults = (): Record<RelationshipTab, RelationshipEntry[]> => ({
  family: [],
  friends: [],
  love: [],
  hate: [],
});
const createRelationshipSelectionDefaults = (): Record<RelationshipTab, string | null> => ({
  family: null,
  friends: null,
  love: null,
  hate: null,
});
const normalizeRelationshipMap = (
  value: Partial<Record<RelationshipTab, RelationshipEntry[]>> | undefined | null
): Record<RelationshipTab, RelationshipEntry[]> => {
  const fallback = createRelationshipDefaults();
  return {
    family: Array.isArray(value?.family) ? value.family : fallback.family,
    friends: Array.isArray(value?.friends) ? value.friends : fallback.friends,
    love: Array.isArray(value?.love) ? value.love : fallback.love,
    hate: Array.isArray(value?.hate) ? value.hate : fallback.hate,
  };
};
const normalizeRelationshipSelection = (
  value: Partial<Record<RelationshipTab, string | null>> | undefined | null
): Record<RelationshipTab, string | null> => {
  const fallback = createRelationshipSelectionDefaults();
  return {
    family: typeof value?.family === "string" ? value.family : fallback.family,
    friends: typeof value?.friends === "string" ? value.friends : fallback.friends,
    love: typeof value?.love === "string" ? value.love : fallback.love,
    hate: typeof value?.hate === "string" ? value.hate : fallback.hate,
  };
};
const tabsStorageKey = "cc-sheet-tabs";

const createTabId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createInitialTabs = () => {
  const fallbackId = createTabId();
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(tabsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const rawTabs = Array.isArray(parsed?.tabs) ? parsed.tabs : [];
        const tabs = rawTabs.map((tab: any, index: number) => ({
          id: typeof tab?.id === "string" ? tab.id : createTabId(),
          title:
            typeof tab?.title === "string" && tab.title.trim().length
              ? tab.title
              : `Sheet ${index + 1}`,
          data: tab?.data ?? null,
          relationships: normalizeRelationshipMap(tab?.relationships),
          relationshipSelection: normalizeRelationshipSelection(tab?.relationshipSelection),
        }));
        if (tabs.length) {
          const activeId =
            typeof parsed?.activeId === "string" && tabs.some((tab: SheetTab) => tab.id === parsed.activeId)
              ? parsed.activeId
              : tabs[0].id;
          return { activeId, tabs };
        }
      }
    } catch {
      // ignore stored tab failures
    }
  }
  return {
    activeId: fallbackId,
    tabs: [
      {
        id: fallbackId,
        title: "Sheet 1",
        data: null,
        relationships: createRelationshipDefaults(),
        relationshipSelection: createRelationshipSelectionDefaults(),
      },
    ],
  };
};

const getCharacterNameFromSnapshot = (data: any) => {
  const identity = data?.identity ?? {};
  const rawName =
    identity.Name || identity.name || identity["Character Name"] || identity.characterName;
  return typeof rawName === "string" ? rawName.trim() : "";
};

export default function App() {
  const initialTabs = useMemo(createInitialTabs, []);
  const [tabs, setTabs] = useState<SheetTab[]>(initialTabs.tabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs.activeId);
  const tabsRef = useRef<SheetTab[]>(initialTabs.tabs);
  const [sheetReady, setSheetReady] = useState(false);
  const hasAppliedStoredTab = useRef(false);
  const [menuOpen, setMenuOpen] = useState<"file" | "edit" | "view" | "help" | null>(null);
  const menuCloseRef = useRef<number | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    getStoredTheme({
      storageKey: "themeMode",
      defaultTheme: "system",
      allowed: ["galaxy", "atelier", "system", "light", "plain-light", "plain-dark"],
    })
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const sharedThemeUpdatedAtRef = useRef<number>(0);
  const sharedThemeApplyRef = useRef<ThemeMode | null>(null);
  const sharedAnimationsApplyRef = useRef<boolean | null>(null);
  const sharedThemeAllowed = useMemo(
    () => new Set<ThemeMode>(["system", "galaxy", "light", "plain-light", "plain-dark"]),
    []
  );
  const [noteSelectValue, setNoteSelectValue] = useState(noteOptions[0]);
  const [relationshipTab, setRelationshipTab] = useState<RelationshipTab>("family");
  const [relationshipDropdownOpen, setRelationshipDropdownOpen] = useState<RelationshipTab | null>(
    null
  );
  const [relationshipSelection, setRelationshipSelection] = useState<
    Record<RelationshipTab, string | null>
  >(createRelationshipSelectionDefaults);
  const [relationshipMap, setRelationshipMap] = useState<
    Record<RelationshipTab, RelationshipEntry[]>
  >(createRelationshipDefaults);
  const relationshipInputRef = useRef<HTMLInputElement | null>(null);
  const isSharedTheme = (mode: ThemeMode) => mode !== "atelier";
  const [entitlementStatus, setEntitlementStatus] = useState<"checking" | "allowed" | "locked">(
    isTauri ? "checking" : "allowed"
  );
  const [requestedBrowser, setRequestedBrowser] = useState(false);
  const [isPremium, setIsPremium] = useState(!isTauri);
  const [entitlementDebug, setEntitlementDebug] = useState("");
  const [launchToken, setLaunchToken] = useState<LaunchToken | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const cleanup = initSheet();
    setSheetReady(true);
    return cleanup;
  }, []);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    if (!sheetReady || hasAppliedStoredTab.current) return;
    const activeTab = tabsRef.current.find((tab) => tab.id === activeTabId);
    applySheetSnapshot(activeTab?.data ?? null);
    setRelationshipMap(normalizeRelationshipMap(activeTab?.relationships));
    setRelationshipSelection(
      normalizeRelationshipSelection(activeTab?.relationshipSelection)
    );
    hasAppliedStoredTab.current = true;
  }, [activeTabId, sheetReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        tabsStorageKey,
        JSON.stringify({
          activeId: activeTabId,
          tabs,
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!sheetReady) return;
    const input = document.getElementById("characterNameInput") as HTMLInputElement | null;
    if (!input) return;
    const handleInput = () => {
      const value = input.value.trim();
      if (!value) return;
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, title: value } : tab))
      );
    };
    handleInput();
    input.addEventListener("input", handleInput);
    return () => input.removeEventListener("input", handleInput);
  }, [activeTabId, sheetReady]);

  useEffect(() => {
    if (!isTauri) return;
    let active = true;
    readSharedPreferences()
      .then((prefs) => {
        if (!active || !prefs) return;
        const updatedAt = prefs.updatedAt ?? 0;
        sharedThemeUpdatedAtRef.current = updatedAt;
        if (prefs.themeMode && isSharedTheme(themeMode)) {
          const nextTheme = prefs.themeMode as ThemeMode;
          if (sharedThemeAllowed.has(nextTheme) && nextTheme !== themeMode) {
            sharedThemeApplyRef.current = nextTheme;
            setThemeMode(nextTheme);
          }
        }
        if (typeof prefs.animationsEnabled === "boolean") {
          if (prefs.animationsEnabled !== animationsEnabled) {
            sharedAnimationsApplyRef.current = prefs.animationsEnabled;
            setAnimationsEnabled(prefs.animationsEnabled);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyResolvedTheme = () => {
      const resolvedTheme =
        themeMode === "system" ? (media.matches ? "galaxy" : "light") : themeMode;
      const isGalaxy = resolvedTheme === "galaxy";
      const isLight = resolvedTheme === "light";
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      document.body.classList.toggle("ef-galaxy", isGalaxy);
      document.body.classList.toggle("ef-galaxy-light", isLight);
    };
    if (themeMode === "system") {
      localStorage.setItem("themeMode", "system");
    } else {
      applyTheme(themeMode, {
        storageKey: "themeMode",
        defaultTheme: "system",
        allowed: ["galaxy", "atelier", "system", "light", "plain-light", "plain-dark"],
      });
    }
    applyResolvedTheme();
    if (themeMode !== "system") return;
    const handler = () => applyResolvedTheme();
    if ("addEventListener" in media) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute(
      "data-reduce-motion",
      animationsEnabled ? "false" : "true"
    );
  }, [animationsEnabled]);

  useEffect(() => {
    if (!isTauri) return;
    if (sharedThemeApplyRef.current === themeMode) {
      sharedThemeApplyRef.current = null;
      return;
    }
    if (!isSharedTheme(themeMode)) return;
    if (!sharedThemeAllowed.has(themeMode)) return;
    writeSharedPreferences({ themeMode })
      .then((prefs) => {
        if (prefs?.updatedAt) sharedThemeUpdatedAtRef.current = prefs.updatedAt;
      })
      .catch(() => undefined);
  }, [themeMode, sharedThemeAllowed]);

  useEffect(() => {
    if (!isTauri) return;
    if (sharedAnimationsApplyRef.current === animationsEnabled) {
      sharedAnimationsApplyRef.current = null;
      return;
    }
    writeSharedPreferences({ animationsEnabled })
      .then((prefs) => {
        if (prefs?.updatedAt) sharedThemeUpdatedAtRef.current = prefs.updatedAt;
      })
      .catch(() => undefined);
  }, [animationsEnabled]);

  useEffect(() => {
    if (!isTauri) return;
    const interval = window.setInterval(async () => {
      try {
        const prefs = await readSharedPreferences();
        if (!prefs) return;
        const updatedAt = prefs.updatedAt ?? 0;
        if (updatedAt <= sharedThemeUpdatedAtRef.current) return;
        sharedThemeUpdatedAtRef.current = updatedAt;
        if (prefs.themeMode && isSharedTheme(themeMode)) {
          const nextTheme = prefs.themeMode as ThemeMode;
          if (sharedThemeAllowed.has(nextTheme) && nextTheme !== themeMode) {
            sharedThemeApplyRef.current = nextTheme;
            setThemeMode(nextTheme);
          }
        }
        if (typeof prefs.animationsEnabled === "boolean") {
          if (prefs.animationsEnabled !== animationsEnabled) {
            sharedAnimationsApplyRef.current = prefs.animationsEnabled;
            setAnimationsEnabled(prefs.animationsEnabled);
          }
        }
      } catch {
        // ignore poll failures
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [themeMode, sharedThemeAllowed]);

  useEffect(() => {
    if (isTauri) return;
    const params = new URLSearchParams(window.location.search);
    setIsPremium(params.get("tier") === "premium");
  }, []);

  const refreshEntitlement = async () => {
    if (!isTauri) {
      setEntitlementStatus("allowed");
      setIsPremium(true);
      return;
    }
    const token = await refreshLaunchToken(appId);
    console.log("[Character Creation] launch token", token);
    setLaunchToken(token);
    const allowed = isEntitledForApp(token, appId);
    setEntitlementStatus(allowed ? "allowed" : "locked");
    setIsPremium(allowed);
    const now = Date.now();
    const expires = token?.expiresAt ?? 0;
    const debug = token
      ? `token ${token.appId} exp ${new Date(expires).toLocaleString()} (${expires - now}ms)`
      : "no token found";
    setEntitlementDebug(debug);
  };

  useEffect(() => {
    refreshEntitlement();
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    const interval = window.setInterval(() => {
      refreshEntitlement();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [isTauri]);

  useEffect(() => {
    if (entitlementStatus !== "locked" || requestedBrowser) return;
    setRequestedBrowser(true);
    openAppBrowser(appId);
  }, [entitlementStatus, requestedBrowser]);

  const openMenu = (name: "file" | "edit" | "view" | "help") => {
    if (menuCloseRef.current !== null) {
      window.clearTimeout(menuCloseRef.current);
      menuCloseRef.current = null;
    }
    setMenuOpen(name);
  };

  const closeMenu = () => {
    if (menuCloseRef.current !== null) {
      window.clearTimeout(menuCloseRef.current);
    }
    menuCloseRef.current = window.setTimeout(() => {
      setMenuOpen(null);
      menuCloseRef.current = null;
    }, 150);
  };

  const openPreferences = () => {
    setPreferencesOpen(true);
    setMenuOpen(null);
  };

  const triggerImport = () => {
    if (!isPremium) return;
    const input = document.getElementById("importFile") as HTMLInputElement | null;
    input?.click();
    setMenuOpen(null);
  };

  const triggerExport = () => {
    if (!isPremium) return;
    if (!sheetReady) return;
    const snapshot = getSheetSnapshot();
    const payload = {
      ...(snapshot ?? { version: 2 }),
      relationships: relationshipMap,
      relationshipSelection,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "character-sheet.json";
    link.click();
    URL.revokeObjectURL(url);
    setMenuOpen(null);
  };

  const triggerSave = () => {
    if (!isPremium) return;
    if (!sheetReady) return;
    const snapshot = getSheetSnapshot();
    const nextTabs = tabsRef.current.map((tab) =>
      tab.id === activeTabId
        ? {
            ...tab,
            data: snapshot,
            relationships: relationshipMap,
            relationshipSelection,
          }
        : tab
    );
    setTabs(nextTabs);
    setMenuOpen(null);
  };

  const startNewSheet = () => {
    createNewTab();
    setMenuOpen(null);
  };

  const openAbout = () => {
    window.alert("Character Creation");
    setMenuOpen(null);
  };

  const displayName =
    launchToken?.displayName || launchToken?.email?.split("@")[0] || "Account";
  const rawAvatarUrl = launchToken?.avatarUrl ?? null;
  const normalizedAvatarPath = launchToken?.avatarPath
    ? launchToken.avatarPath.replace(/\\/g, "/")
    : null;
  const canUseLocalAvatar =
    isTauri &&
    typeof window !== "undefined" &&
    (window.location.protocol === "tauri:" || window.location.hostname === "tauri.localhost");
  const avatarUrl =
    canUseLocalAvatar && normalizedAvatarPath ? convertFileSrc(normalizedAvatarPath) : rawAvatarUrl;
  const avatarUrlFallback = canUseLocalAvatar && normalizedAvatarPath ? rawAvatarUrl : null;

  const openProfile = () => {
    const url = "https://enderfall.co.uk/profile";
    if (isTauri) {
      openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  };

  const commitActiveTab = () => {
    if (!sheetReady) return;
    const snapshot = getSheetSnapshot();
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              data: snapshot,
              relationships: relationshipMap,
              relationshipSelection,
            }
          : tab
      )
    );
  };

  const applyTabSnapshot = (tabId: string) => {
    const target = tabsRef.current.find((tab) => tab.id === tabId);
    applySheetSnapshot(target?.data ?? null);
    setRelationshipMap(normalizeRelationshipMap(target?.relationships));
    setRelationshipSelection(normalizeRelationshipSelection(target?.relationshipSelection));
    const nextTitle = getCharacterNameFromSnapshot(target?.data);
    if (nextTitle) {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, title: nextTitle } : tab))
      );
    }
  };

  const setActiveTab = (tabId: string) => {
    if (!sheetReady) return;
    if (tabId === activeTabId) return;
    commitActiveTab();
    setActiveTabId(tabId);
    applyTabSnapshot(tabId);
  };

  const createNewTab = () => {
    if (!sheetReady) return;
    const nextId = createTabId();
    const nextTitle = `Sheet ${tabsRef.current.length + 1}`;
    commitActiveTab();
    resetSheetToDefaults();
    const blankSnapshot = getSheetSnapshot();
    setTabs((prev) => [
      ...prev,
      {
        id: nextId,
        title: nextTitle,
        data: blankSnapshot,
        relationships: createRelationshipDefaults(),
        relationshipSelection: createRelationshipSelectionDefaults(),
      },
    ]);
    setActiveTabId(nextId);
    setRelationshipMap(createRelationshipDefaults());
    setRelationshipSelection(createRelationshipSelectionDefaults());
  };

  const removeTab = (tabId: string) => {
    if (!sheetReady) return;
    const currentTabs = tabsRef.current;
    if (currentTabs.length <= 1) return;
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const wasActive = tabId === activeTabId;
    setTabs(nextTabs);
    if (wasActive) {
      const removedIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const fallbackIndex = removedIndex > 0 ? removedIndex - 1 : 0;
      const nextTab = nextTabs[fallbackIndex] ?? nextTabs[0];
      if (nextTab) {
        setActiveTabId(nextTab.id);
        applySheetSnapshot(nextTab.data ?? null);
        setRelationshipMap(normalizeRelationshipMap(nextTab.relationships));
        setRelationshipSelection(normalizeRelationshipSelection(nextTab.relationshipSelection));
      }
    }
  };

  const handleImportTab = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const nextId = createTabId();
      const nameFromData = getCharacterNameFromSnapshot(data);
      const nextTitle =
        nameFromData ||
        file.name.replace(/\.[^/.]+$/, "") ||
        `Sheet ${tabsRef.current.length + 1}`;
      commitActiveTab();
      setTabs((prev) => [
        ...prev,
        {
          id: nextId,
          title: nextTitle,
          data,
          relationships: normalizeRelationshipMap(data?.relationships),
          relationshipSelection: normalizeRelationshipSelection(data?.relationshipSelection),
        },
      ]);
      setActiveTabId(nextId);
      applySheetSnapshot(data);
      setRelationshipMap(normalizeRelationshipMap(data?.relationships));
      setRelationshipSelection(normalizeRelationshipSelection(data?.relationshipSelection));
    } catch (err) {
      console.error("Invalid import file", err);
    } finally {
      event.target.value = "";
    }
    setMenuOpen(null);
  };

  const triggerRelationshipImport = () => {
    relationshipInputRef.current?.click();
  };

  const makeRelationshipId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `rel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const getRelationshipName = (data: any, fileName: string) => {
    const identity = data?.identity ?? {};
    const rawName =
      identity.Name || identity.name || identity["Character Name"] || identity.characterName;
    const cleaned = typeof rawName === "string" ? rawName.trim() : "";
    if (cleaned) {
      return cleaned;
    }
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    return baseName || "Imported Sheet";
  };

  const parseRelationshipFile = async (file: File, target: RelationshipTab) => {
    try {
      const raw = await file.text();
      const data = JSON.parse(raw);
      const name = getRelationshipName(data, file.name);
      const portrait = typeof data?.portrait === "string" ? data.portrait : null;
      return {
        id: makeRelationshipId(),
        name,
        portrait,
        relation: target === "family" ? "" : undefined,
        sourceFile: file.name,
        addedAt: Date.now(),
      } as RelationshipEntry;
    } catch {
      return null;
    }
  };

  const handleRelationshipImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const target = relationshipTab;
    const entries = await Promise.all(
      Array.from(files).map((file) => parseRelationshipFile(file, target))
    );
    const valid = entries.filter((entry) => entry) as RelationshipEntry[];
    if (valid.length) {
      setRelationshipMap((prev) => ({
        ...prev,
        [target]: [...valid, ...prev[target]],
      }));
      if (!relationshipSelection[target]) {
        setRelationshipSelection((prev) => ({
          ...prev,
          [target]: valid[0]?.id ?? null,
        }));
      }
    }
    event.target.value = "";
  };

  const updateRelationship = (
    target: RelationshipTab,
    id: string,
    updates: Partial<RelationshipEntry>
  ) => {
    setRelationshipMap((prev) => ({
      ...prev,
      [target]: prev[target].map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      ),
    }));
  };

  const removeRelationship = (target: RelationshipTab, id: string) => {
    setRelationshipMap((prev) => ({
      ...prev,
      [target]: prev[target].filter((entry) => entry.id !== id),
    }));
    setRelationshipSelection((prev) => ({
      ...prev,
      [target]: prev[target] === id ? null : prev[target],
    }));
  };

  const confirmRelationshipEdit = (target: RelationshipTab) => {
    setRelationshipSelection((prev) => ({
      ...prev,
      [target]: null,
    }));
  };

  const activeRelationships = relationshipMap[relationshipTab];
  const activeRelationshipId = relationshipSelection[relationshipTab];
  const activeRelationship =
    activeRelationshipId &&
    activeRelationships.find((entry) => entry.id === activeRelationshipId);
  const familyDropdownItems = relationshipMap.family.map((entry) => ({
    id: entry.id,
    label: entry.name,
    subtitle: entry.relation ?? undefined,
    avatarUrl: entry.portrait ?? null,
    avatarFallback: entry.name.slice(0, 1).toUpperCase(),
    onClick: () => {
      setRelationshipTab("family");
      setRelationshipSelection((prev) => ({ ...prev, family: entry.id }));
    },
    onEdit: () => {
      setRelationshipTab("family");
      setRelationshipSelection((prev) => ({ ...prev, family: entry.id }));
    },
    onDelete: () => removeRelationship("family", entry.id),
  }));
  const friendsDropdownItems = relationshipMap.friends.map((entry) => ({
    id: entry.id,
    label: entry.name,
    avatarUrl: entry.portrait ?? null,
    avatarFallback: entry.name.slice(0, 1).toUpperCase(),
    onClick: () => {
      setRelationshipTab("friends");
      setRelationshipSelection((prev) => ({ ...prev, friends: entry.id }));
    },
    onEdit: () => {
      setRelationshipTab("friends");
      setRelationshipSelection((prev) => ({ ...prev, friends: entry.id }));
    },
    onDelete: () => removeRelationship("friends", entry.id),
  }));
  const loveDropdownItems = relationshipMap.love.map((entry) => ({
    id: entry.id,
    label: entry.name,
    avatarUrl: entry.portrait ?? null,
    avatarFallback: entry.name.slice(0, 1).toUpperCase(),
    onClick: () => {
      setRelationshipTab("love");
      setRelationshipSelection((prev) => ({ ...prev, love: entry.id }));
    },
    onEdit: () => {
      setRelationshipTab("love");
      setRelationshipSelection((prev) => ({ ...prev, love: entry.id }));
    },
    onDelete: () => removeRelationship("love", entry.id),
  }));
  const hateDropdownItems = relationshipMap.hate.map((entry) => ({
    id: entry.id,
    label: entry.name,
    avatarUrl: entry.portrait ?? null,
    avatarFallback: entry.name.slice(0, 1).toUpperCase(),
    onClick: () => {
      setRelationshipTab("hate");
      setRelationshipSelection((prev) => ({ ...prev, hate: entry.id }));
    },
    onEdit: () => {
      setRelationshipTab("hate");
      setRelationshipSelection((prev) => ({ ...prev, hate: entry.id }));
    },
    onDelete: () => removeRelationship("hate", entry.id),
  }));
  const familyAvatar = relationshipMap.family[0]?.portrait ?? null;
  const friendsAvatar = relationshipMap.friends[0]?.portrait ?? null;
  const loveAvatar = relationshipMap.love[0]?.portrait ?? null;
  const hateAvatar = relationshipMap.hate[0]?.portrait ?? null;

  return (
    <div className="page">
      <AccessGate
        status={entitlementStatus}
        primaryLabel="Open Enderfall Hub"
        secondaryLabel="Retry"
        onPrimary={() => openAppBrowser(appId)}
        onSecondary={refreshEntitlement}
        primaryClassName="action-btn"
        secondaryClassName="action-btn"
        messageLocked={`Open Enderfall Hub to verify premium or admin access. (${entitlementDebug})`}
      />
      <MainHeader
        logoSrc="/brand/enderfall-mark.png"
        menus={[
          {
            id: "file",
            label: "File",
            content: (
              <>
                <button
                  className="ef-menu-item"
                  type="button"
                  onClick={triggerImport}
                  disabled={!isPremium}
                  title={!isPremium ? "Premium required" : undefined}
                >
                  Open...
                </button>
                <button
                  className="ef-menu-item"
                  type="button"
                  onClick={triggerSave}
                  disabled={!isPremium}
                  title={!isPremium ? "Premium required" : undefined}
                >
                  Save...
                </button>
                <button
                  className="ef-menu-item"
                  type="button"
                  onClick={triggerExport}
                  disabled={!isPremium}
                  title={!isPremium ? "Premium required" : undefined}
                >
                  Export...
                </button>
                <div className="ef-menu-divider" />
                <button className="ef-menu-item" type="button" onClick={startNewSheet}>
                  New sheet
                </button>
                <button className="ef-menu-item" type="button" onClick={openPreferences}>
                  Preferences
                </button>
              </>
            ),
          },
          {
            id: "edit",
            label: "Edit",
            content: (
              <>
                <button className="ef-menu-item" type="button" disabled>
                  Undo
                </button>
                <button className="ef-menu-item" type="button" disabled>
                  Redo
                </button>
              </>
            ),
          },
          {
            id: "view",
            label: "View",
            content: (
              <div className="ef-menu-item has-submenu" role="button" tabIndex={0}>
                <span>Theme</span>
                <span className="ef-menu-sub-caret">
                  <IconChevronDown />
                </span>
                <div className="ef-menu-sub">
                  {themeOptions.map((item) => (
                    <button
                      key={item.value}
                      className="ef-menu-item"
                      type="button"
                      onClick={() => {
                        setThemeMode(item.value);
                        setMenuOpen(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ),
          },
          {
            id: "help",
            label: "Help",
            content: (
              <button className="ef-menu-item" type="button" onClick={openAbout}>
                About
              </button>
            ),
          },
        ]}
        menuOpen={menuOpen}
        onOpenMenu={openMenu}
        onCloseMenu={closeMenu}
        actions={
          <div className="actions">
              <Dropdown
                variant="user"
                name={displayName}
                avatarUrl={avatarUrl}
                avatarUrlFallback={avatarUrlFallback}
                avatarFallback={displayName.slice(0, 1).toUpperCase()}
                items={[
                  {
                    label: "Open Enderfall Hub",
                    onClick: () => openAppBrowser(appId),
                    title: "Focuses Enderfall Hub if it's already open.",
                  },
                  {
                    label: "Profile",
                    onClick: openProfile,
                  },
                ]}
            />
          </div>
        }
      />
      {!isPremium ? (
        <div className="premium-banner">
          Free mode active. Import and export unlock with premium access.
        </div>
      ) : null}
      <Panel variant="card" borderWidth={1} className="sheet-tabs">
        <div className="sheet-tab-track">
          {tabs.map((tab) => (
            <div key={tab.id} className="sheet-tab-item">
              <Button
                type="button"
                variant="ghost"
                className={`sheet-tab ${tab.id === activeTabId ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.title}
              </Button>
              <Button
                type="button"
                variant="delete"
                className="sheet-tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={() => removeTab(tab.id)}
                disabled={tabs.length <= 1}
              >
                <IconClose />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="primary" className="sheet-tab-add" onClick={createNewTab}>
          + New
        </Button>
      </Panel>
      <Panel variant="card" borderWidth={2} className="frame">
          <div className="sheet">
            <div className="left-panel fade-in">
              <Panel variant="card" borderWidth={2} className="portrait-card">
                <img className="portrait" id="portraitPreview" alt="portrait preview" />
                <div className="portrait-placeholder" id="portraitPlaceholder">Upload Portrait</div>
                <Button
                  type="button"
                  className="upload-chip"
                  onClick={() => portraitInputRef.current?.click()}
                >
                  Upload
                </Button>
                <input
                  ref={portraitInputRef}
                  type="file"
                  id="portraitInput"
                  accept="image/*"
                  style={{ display: "none" }}
                />
              </Panel>
              <Panel variant="card" borderWidth={2} className="bio-card">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Character Notes</span>
                </Panel>
                <div className="note-controls">
                  <Dropdown
                    variant="bookmark"
                    layout="field"
                    value={noteSelectValue}
                    onChange={(value) => setNoteSelectValue(String(value))}
                    sections={[
                      {
                        options: noteOptions.map((option) => ({
                          value: option,
                          label: option,
                        })),
                      },
                    ]}
                  />
                  <Select
                    id="noteSelect"
                    className="note-select-hidden"
                    value={noteSelectValue}
                    onChange={(event) => setNoteSelectValue(event.target.value)}
                  >
                    {noteOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" id="addNoteBtn">Add</Button>
                </div>
                <div className="notes-scroll" id="notesScroll">
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Personality">
                    <div className="note-header">
                      <span>Personality</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Personality notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Hobbies">
                    <div className="note-header">
                      <span>Hobbies</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Hobbies notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Food-Related">
                    <div className="note-header">
                      <span>Food-Related</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Food related notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Habits">
                    <div className="note-header">
                      <span>Habits</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Habits notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Quirks">
                    <div className="note-header">
                      <span>Quirks</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Quirks notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Extras">
                    <div className="note-header">
                      <span>Extras</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Extras notes" />
                  </Panel>
                </div>
              </Panel>
            </div>
      
            <div className="right-panel fade-in">
              <Panel variant="card" borderWidth={2} className="section" data-section="identity">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Identity</span>
                </Panel>
                <div className="identity">
                  <div className="label-row">
                    <span>Name</span>
                    <Input
                      id="characterNameInput"
                      className="line-input"
                      type="text"
                      defaultValue="Jane Doe"
                    />
                  </div>
                  <div className="label-row"><span>Nickname</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Race/Species</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Age</span><Input className="line-input" type="text" defaultValue="XX" /></div>
                  <div className="label-row"><span>Gender</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Birthday</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Class/Job</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Height</span><Input className="line-input" type="text" defaultValue="XXX cm" /></div>
                </div>
              </Panel>
      
              <Panel variant="card" borderWidth={2} className="section relationships-section">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Connections</span>
                  <div className="relationship-actions">
                    <Button type="button" onClick={triggerRelationshipImport}>
                      Import to{" "}
                      {relationshipTab === "family"
                        ? "Family"
                        : relationshipTab === "friends"
                          ? "Friends"
                          : relationshipTab === "love"
                            ? "Love"
                            : "Hate"}
                    </Button>
                    <input
                      ref={relationshipInputRef}
                      type="file"
                      id="relationshipImport"
                      accept="application/json"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleRelationshipImport}
                    />
                  </div>
                </Panel>
                <div className="relationship-tabs">
                  <Dropdown
                    variant="user-list"
                    name={`Family (${relationshipMap.family.length})`}
                    avatarUrl={familyAvatar}
                    items={familyDropdownItems}
                    emptyLabel="No family added yet."
                    open={relationshipDropdownOpen === "family"}
                    onOpenChange={(open) => {
                      setRelationshipDropdownOpen(open ? "family" : null);
                      if (open) setRelationshipTab("family");
                    }}
                  />
                  <Dropdown
                    variant="user-list"
                    name={`Friends (${relationshipMap.friends.length})`}
                    avatarUrl={friendsAvatar}
                    items={friendsDropdownItems}
                    emptyLabel="No friends added yet."
                    open={relationshipDropdownOpen === "friends"}
                    onOpenChange={(open) => {
                      setRelationshipDropdownOpen(open ? "friends" : null);
                      if (open) setRelationshipTab("friends");
                    }}
                  />
                  <Dropdown
                    variant="user-list"
                    name={`Love (${relationshipMap.love.length})`}
                    avatarUrl={loveAvatar}
                    items={loveDropdownItems}
                    emptyLabel="No love entries yet."
                    open={relationshipDropdownOpen === "love"}
                    onOpenChange={(open) => {
                      setRelationshipDropdownOpen(open ? "love" : null);
                      if (open) setRelationshipTab("love");
                    }}
                  />
                  <Dropdown
                    variant="user-list"
                    name={`Hate (${relationshipMap.hate.length})`}
                    avatarUrl={hateAvatar}
                    items={hateDropdownItems}
                    emptyLabel="No hate entries yet."
                    open={relationshipDropdownOpen === "hate"}
                    onOpenChange={(open) => {
                      setRelationshipDropdownOpen(open ? "hate" : null);
                      if (open) setRelationshipTab("hate");
                    }}
                  />
                </div>
                {activeRelationship ? (
                  <div className="relationship-list">
                    <Panel variant="card" borderWidth={1} className="relationship-card">
                      <div className="relationship-avatar">
                        {activeRelationship.portrait ? (
                          <img
                            src={activeRelationship.portrait}
                            alt={`${activeRelationship.name} portrait`}
                          />
                        ) : (
                          <span>{activeRelationship.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="relationship-meta">
                        <div className="relationship-name">{activeRelationship.name}</div>
                        {relationshipTab === "family" ? (
                          <Input
                            className="relationship-input"
                            type="text"
                            value={activeRelationship.relation ?? ""}
                            placeholder="e.g. Mother"
                            onChange={(event) =>
                              updateRelationship("family", activeRelationship.id, {
                                relation: event.target.value,
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                confirmRelationshipEdit("family");
                              }
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="relationship-card-actions">
                        <Button
                          type="button"
                          variant="success"
                          className="relationship-confirm"
                          onClick={() => confirmRelationshipEdit(relationshipTab)}
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="delete"
                          className="relationship-remove"
                          onClick={() => removeRelationship(relationshipTab, activeRelationship.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </Panel>
                  </div>
                ) : null}
              </Panel>

              <Panel variant="card" borderWidth={2} className="section" data-section="body">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Body</span>
                </Panel>
                <div className="stats-grid">
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Strength</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Dexterity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Health</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Energy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Beauty</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Style</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </div>
              </Panel>
      
              <div className="core-grid">
                <Panel variant="card" borderWidth={2} className="section" data-section="skills">
                  <Panel variant="highlight" borderWidth={1} className="panel-header">
                    <span className="panel-title">Skills</span>
                  </Panel>
                  <div className="skill-grid">
                    <div className="mini-list">
                      <div className="dot-row"><span className="stat-chip">Perception</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Communication</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Persuasion</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Mediation</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Literacy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Creativity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Cooking</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Combat</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    </div>
                    <div className="mini-list">
                      <div className="dot-row"><span className="stat-chip">Survival</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Stealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Tech Savvy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Street Smarts</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Seduction</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Animal Handling</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Child Handling</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    </div>
                  </div>
                </Panel>
      
                <Panel variant="card" borderWidth={2} className="section" data-section="priorities">
                  <Panel variant="highlight" borderWidth={1} className="panel-header">
                    <span className="panel-title">Priorities</span>
                  </Panel>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Justice</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Truth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Power</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Fame</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Wealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Family</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Friends</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Love</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Home</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Health</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Approval</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </Panel>
              </div>
      
              <Panel variant="card" borderWidth={2} className="section" data-section="mind">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Mind</span>
                </Panel>
                <div className="stats-grid">
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Intelligence</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Happiness</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Spirituality</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Confidence</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Humor</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Anxiety</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Patience</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Passion</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </div>
                <div className="stacked">
                  <div className="range-row"><span>Nice</span><Slider min="0" max="100" defaultValue="45" /><span>Mean</span></div>
                  <div className="range-row"><span>Brave</span><Slider min="0" max="100" defaultValue="50" /><span>Cowardly</span></div>
                  <div className="range-row"><span>Pacifist</span><Slider min="0" max="100" defaultValue="55" /><span>Violent</span></div>
                  <div className="range-row"><span>Thoughtful</span><Slider min="0" max="100" defaultValue="45" /><span>Impulsive</span></div>
                  <div className="range-row"><span>Agreeable</span><Slider min="0" max="100" defaultValue="40" /><span>Contrary</span></div>
                  <div className="range-row"><span>Idealistic</span><Slider min="0" max="100" defaultValue="45" /><span>Pragmatic</span></div>
                  <div className="range-row"><span>Frugal</span><Slider min="0" max="100" defaultValue="50" /><span>Big Spender</span></div>
                  <div className="range-row"><span>Extrovert</span><Slider min="0" max="100" defaultValue="55" /><span>Introvert</span></div>
                  <div className="range-row"><span>Collected</span><Slider min="0" max="100" defaultValue="50" /><span>Wild</span></div>
                </div>
                <div className="traits">
                  <Toggle variant="checkbox" label="Ambitious" />
                  <Toggle variant="checkbox" label="Possessive" />
                  <Toggle variant="checkbox" label="Stubborn" />
                  <Toggle variant="checkbox" label="Jealous" />
                  <Toggle variant="checkbox" label="Decisive" />
                  <Toggle variant="checkbox" label="Perfectionist" />
                </div>
              </Panel>
      
              <Panel variant="card" borderWidth={2} className="section" data-section="social">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Social</span>
                </Panel>
                <div className="social-content">
                  <div>
                    <div className="dot-row"><span className="stat-chip">Charisma</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Empathy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Generosity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Wealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Aggression</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Libido</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="social-grid">
                    <div className="social-slider"><span>Honest</span><Slider min="0" max="100" defaultValue="55" /><span>Deceptive</span></div>
                    <div className="social-slider"><span>Leader</span><Slider min="0" max="100" defaultValue="60" /><span>Follower</span></div>
                    <div className="social-slider"><span>Polite</span><Slider min="0" max="100" defaultValue="50" /><span>Rude</span></div>
                    <div className="social-slider"><span>Political</span><Slider min="0" max="100" defaultValue="45" /><span>Indifferent</span></div>
                  </div>
                  <div className="checkbox-list">
                    <Toggle variant="checkbox" label="Cool" />
                    <Toggle variant="checkbox" label="Flirty" />
                    <Toggle variant="checkbox" label="Cute" />
                    <Toggle variant="checkbox" label="Obedient" />
                    <Toggle variant="checkbox" label="Fun" />
                    <Toggle variant="checkbox" label="Forgiving" />
                    <Toggle variant="checkbox" label="Gullible" />
                    <Toggle variant="checkbox" label="Scary" />
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </Panel>
      
      <div>
        <input
          type="file"
          id="importFile"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleImportTab}
        />
      </div>

        <PreferencesModal
          isOpen={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          themeMode={themeMode}
          onThemeChange={(value) => setThemeMode(value as ThemeMode)}
          themeOptions={themeOptions}
          animationsEnabled={animationsEnabled}
          onAnimationsChange={setAnimationsEnabled}
        />
     
      
    </div>
  );
}

