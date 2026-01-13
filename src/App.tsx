import { useEffect, useMemo, useRef, useState } from "react";
import { initSheet } from "./sheet";
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

const noteOptions = [
  "Personality",
  "Hobbies",
  "Food-Related",
  "Habits",
  "Quirks",
  "Extras",
];

export default function App() {
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
    return initSheet();
  }, []);

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
    const button = document.getElementById("exportBtn") as HTMLButtonElement | null;
    button?.click();
    setMenuOpen(null);
  };

  const startNewSheet = () => {
    window.location.reload();
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
                  Import...
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
                  <div className="label-row"><span>Name</span><Input className="line-input" type="text" defaultValue="Jane Doe" /></div>
                  <div className="label-row"><span>Nickname</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Race/Species</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Age</span><Input className="line-input" type="text" defaultValue="XX" /></div>
                  <div className="label-row"><span>Gender</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Birthday</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Class/Job</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Height</span><Input className="line-input" type="text" defaultValue="XXX cm" /></div>
                </div>
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
          <button
            className="action-btn"
            id="importBtn"
            type="button"
            disabled={!isPremium}
            title={!isPremium ? "Premium required" : undefined}
          >
            Import
          </button>
          <button
            className="action-btn"
            id="exportBtn"
            type="button"
            disabled={!isPremium}
            title={!isPremium ? "Premium required" : undefined}
          >
            Export
          </button>
          <input type="file" id="importFile" accept="application/json" style={{ display: "none" }} />
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

